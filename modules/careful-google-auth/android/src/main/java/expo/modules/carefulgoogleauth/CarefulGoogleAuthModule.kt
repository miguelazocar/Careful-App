package expo.modules.carefulgoogleauth

import android.accounts.Account
import android.app.Activity
import android.content.Context
import com.google.android.gms.auth.api.identity.AuthorizationClient
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AuthorizeOptions : Record {
  @Field val scopes: List<String> = emptyList()

  /** Email of the account to use. Null lets Google pick (or ask, when several exist). */
  @Field val account: String? = null

  /** When false, never show UI: fail with ERR_CONSENT_REQUIRED instead (background work). */
  @Field val interactive: Boolean = true

  /** Always show the account chooser (used when connecting). */
  @Field val selectAccount: Boolean = false
}

private const val GOOGLE_ACCOUNT_TYPE = "com.google"
private const val REQUEST_CODE = 0x4CA7

/**
 * Authorization-only access to Google APIs (no "sign in" needed) through Google Identity Services.
 * The OAuth client is matched by package name + signing certificate SHA-1, so no client ID
 * or secret ships with the app.
 */
class CarefulGoogleAuthModule : Module() {
  private var pending: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun client(activity: Activity?): AuthorizationClient =
    if (activity != null) Identity.getAuthorizationClient(activity) else Identity.getAuthorizationClient(context)

  override fun definition() = ModuleDefinition {
    Name("CarefulGoogleAuth")

    AsyncFunction("authorize") { options: AuthorizeOptions, promise: Promise ->
      val activity = appContext.currentActivity
      val builder = AuthorizationRequest.builder().setRequestedScopes(options.scopes.map { Scope(it) })
      options.account?.takeIf { it.isNotBlank() }?.let { builder.setAccount(Account(it, GOOGLE_ACCOUNT_TYPE)) }
      if (options.selectAccount) builder.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)

      client(activity).authorize(builder.build())
        .addOnSuccessListener { result ->
          if (!result.hasResolution()) {
            promise.resolve(result.toBundleMap())
            return@addOnSuccessListener
          }
          val intent = result.pendingIntent
          if (!options.interactive || activity == null || intent == null) {
            promise.reject("ERR_CONSENT_REQUIRED", "Google needs the user to grant access again", null)
            return@addOnSuccessListener
          }
          if (pending != null) {
            promise.reject("ERR_IN_PROGRESS", "Another authorization is already in progress", null)
            return@addOnSuccessListener
          }
          pending = promise
          try {
            @Suppress("DEPRECATION")
            activity.startIntentSenderForResult(intent.intentSender, REQUEST_CODE, null, 0, 0, 0)
          } catch (e: Exception) {
            pending = null
            promise.reject("ERR_LAUNCH", e.message ?: "Could not open the Google consent screen", e)
          }
        }
        .addOnFailureListener { e -> rejectWith(promise, e) }
    }

    /** Drops a cached access token (e.g. after the API answered 401) so the next authorize() mints a new one. */
    AsyncFunction("clearToken") { token: String, promise: Promise ->
      client(null).clearToken(ClearTokenRequest.builder().setToken(token).build())
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { promise.resolve(null) }
    }

    /** Revokes the grant so the app disappears from the user's Google account connections. */
    AsyncFunction("revokeAccess") { account: String, scopes: List<String>, promise: Promise ->
      val request = RevokeAccessRequest.builder()
        .setAccount(Account(account, GOOGLE_ACCOUNT_TYPE))
        .setScopes(scopes.map { Scope(it) })
        .build()
      client(null).revokeAccess(request)
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { e -> rejectWith(promise, e) }
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      val data = payload.data
      if (data == null) {
        promise.reject("ERR_CANCELED", "The user closed the Google consent screen", null)
        return@OnActivityResult
      }
      try {
        val result = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data)
        if (result.accessToken.isNullOrEmpty()) {
          promise.reject("ERR_CANCELED", "Access was not granted", null)
        } else {
          promise.resolve(result.toBundleMap())
        }
      } catch (e: Exception) {
        rejectWith(promise, e)
      }
    }
  }

  private fun rejectWith(promise: Promise, e: Exception) {
    val status = (e as? ApiException)?.statusCode
    val code = when (status) {
      CommonStatusCodes.CANCELED, 12501 -> "ERR_CANCELED"
      CommonStatusCodes.DEVELOPER_ERROR -> "ERR_DEVELOPER"
      CommonStatusCodes.NETWORK_ERROR -> "ERR_NETWORK"
      CommonStatusCodes.SIGN_IN_REQUIRED -> "ERR_CONSENT_REQUIRED"
      else -> "ERR_AUTH"
    }
    val detail = e.message ?: e.javaClass.simpleName
    promise.reject(code, if (status != null) "[$status] $detail" else detail, e)
  }
}

private fun AuthorizationResult.toBundleMap(): Map<String, Any?> = mapOf(
  "accessToken" to accessToken,
  "grantedScopes" to grantedScopes,
  "email" to toGoogleSignInAccount()?.email,
)
