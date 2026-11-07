import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Icon, ListRow, Segmented } from '@/components/ui/primitives';
import { getGeminiKey, saveGeminiKey, testGeminiKey } from '@/services/ai';
import { useSettings, type AiProviderPreference } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function AiSettingsScreen() {
  const { colors } = useTheme();
  const ai = useSettings((s) => s.ai);
  const [key, setKey] = useState('');
  const [model, setModel] = useState(ai.model);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void getGeminiKey().then((k) => setKey(k ? `${k.slice(0, 6)}••••••••${k.slice(-4)}` : ''));
  }, []);

  const saveKey = async () => {
    const value = key.trim();
    if (!value || value.includes('•')) return toast('Pegá tu clave de API', 'info');
    setTesting(true);
    const error = await testGeminiKey(value);
    setTesting(false);
    if (error) return toast(error, 'error');
    await saveGeminiKey(value);
    await useSettings.getState().patch('ai', { hasKey: true, model: model.trim() || 'gemini-flash-latest' });
    setKey(`${value.slice(0, 6)}••••••••${value.slice(-4)}`);
    toast('Gemini conectado');
  };

  const removeKey = async () => {
    await saveGeminiKey(null);
    await useSettings.getState().patch('ai', { hasKey: false });
    setKey('');
    toast('Clave eliminada');
  };

  return (
    <Screen header={<Header back title="Inteligencia artificial" />}>
      <AppText tone="muted">
        La IA completa datos desde la cédula, lee la patente en la foto, investiga los fluidos de tu auto y mejora tus descripciones.
      </AppText>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Motor de IA
        </AppText>
        <Segmented<AiProviderPreference>
          value={ai.provider}
          onChange={(v) => void useSettings.getState().patch('ai', { provider: v })}
          options={[
            { value: 'auto', label: 'Automático' },
            { value: 'gemini', label: 'Gemini' },
            { value: 'local', label: 'Teléfono' },
          ]}
        />
        <AppText variant="caption" tone="subtle">
          {ai.provider === 'auto'
            ? 'Usa Gemini si configuraste tu clave; si no, o sin conexión, usa la IA del teléfono.'
            : ai.provider === 'gemini'
              ? 'Siempre Gemini (requiere internet y tu clave).'
              : 'Todo en el teléfono: sin internet y sin costo. Lectura de texto con ML Kit y reglas propias.'}
        </AppText>
      </View>

      <Card padded={false}>
        <ListRow icon="cellphone" iconColor={colors.success} title="En el teléfono" subtitle="Lectura de cédula y patente (OCR), catálogo de fluidos y estandarización de texto. Gratis y offline." />
        <ListRow icon="google" iconColor="#4285F4" title="Gemini (Google)" subtitle="Mejor precisión: entiende fotos, busca en manuales oficiales y redacta como un jefe de taller." last />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Conectar Gemini
        </AppText>
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Icon name="key-variant" size={22} color={colors.primary} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              Creá una clave gratuita con tu cuenta de Google en Google AI Studio y pegala acá. Se guarda cifrada en el teléfono y solo se usa para hablar con Gemini.
            </AppText>
          </View>
          <Button label="Obtener clave en AI Studio" icon="open-in-new" variant="ghost" size="sm" onPress={() => void Linking.openURL('https://aistudio.google.com/app/apikey')} />
          <TextField label="Clave de API" value={key} onChangeText={setKey} placeholder="AIza…" autoCapitalize="none" autoCorrect={false} icon="key-variant" />
          <TextField label="Modelo" hint="Por defecto, el Flash más reciente" value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} placeholder="gemini-flash-latest" />
          <Button label={ai.hasKey ? 'Actualizar y probar' : 'Guardar y probar'} icon="check" loading={testing} onPress={() => void saveKey()} />
          {ai.hasKey ? <Button label="Quitar clave" variant="ghost" onPress={() => void removeKey()} /> : null}
        </Card>
      </View>
    </Screen>
  );
}
