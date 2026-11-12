import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { VehiclePhoto } from '@/components/VehicleCard';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, EmptyState, Icon } from '@/components/ui/primitives';
import type { Vehicle } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { archiveReasonIcon, archiveReasonLabel } from '@/domain/archive';
import { formatPlate } from '@/domain/plate';
import { useQuery } from '@/hooks/useQuery';
import { formatDay } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Cars no longer in use (sold, stolen, lost…), newest archive first. Each keeps its whole history. */
export default function ArchivedVehiclesScreen() {
  const { data } = useQuery(async () => (await listVehicles({ includeArchived: true })).filter((v) => v.archivedAt).sort((a, b) => (a.archivedAt! < b.archivedAt! ? 1 : -1)), []);

  return (
    <Screen header={<Header back title="Archivados" />}>
      <AppText variant="body" tone="muted">
        Autos que ya no tenés. No aparecen en el garage ni generan avisos, pero conservan todo su historial y su informe PDF.
      </AppText>
      {data && !data.length ? <EmptyState icon="archive-outline" title="No hay autos archivados" message="Desde el menú ⋮ de un auto podés archivarlo si lo vendiste, te lo robaron o ya no lo tenés." /> : null}
      <View style={{ gap: spacing.sm }}>
        {data?.map((v) => (
          <ArchivedRow key={v.id} vehicle={v} onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: v.id } })} />
        ))}
      </View>
    </Screen>
  );
}

function ArchivedRow({ vehicle: v, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${v.brand} ${v.model}, archivado por ${archiveReasonLabel(v.archivedReason)}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceAlt : colors.surface })}>
      <View style={{ width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden' }}>
        <VehiclePhoto vehicle={v} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <BrandLogo brandId={v.brandId} brand={v.brand} size={20} />
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {v.brand} {v.model}
          </AppText>
        </View>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {[v.plate ? formatPlate(v.plate, v.country) : null, v.year ? String(v.year) : null, v.variant].filter(Boolean).join(' · ')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={archiveReasonIcon(v.archivedReason)} size={14} color={colors.textMuted} />
          <AppText variant="captionStrong" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {archiveReasonLabel(v.archivedReason)} · {formatDay(v.archivedAt!.slice(0, 10))}
            {v.archivedNote ? ` · ${v.archivedNote}` : ''}
          </AppText>
        </View>
      </View>
      <Icon name="chevron-right" size={22} color={colors.textSubtle} />
    </Pressable>
  );
}
