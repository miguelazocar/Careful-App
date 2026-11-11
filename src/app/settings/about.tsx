import Constants from 'expo-constants';
import { Linking, View } from 'react-native';

import { AppIcon, Wordmark } from '@/components/brand';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Card, ListRow } from '@/components/ui/primitives';
import { BRANDS } from '@/data/catalog';
import { spacing } from '@/theme/tokens';

export default function AboutScreen() {
  const models = BRANDS.reduce((s, b) => s + b.models.length, 0);
  return (
    <Screen header={<Header back title="Acerca de" />}>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
        <AppIcon size={96} />
        <Wordmark height={36} />
        <AppText tone="muted" align="center">
          Tu auto, toda su historia en un solo lugar.
        </AppText>
        <AppText variant="caption" tone="subtle">
          Versión {Constants.expoConfig?.version ?? '1.0.0'}
        </AppText>
      </View>
      <Card padded={false}>
        <ListRow icon="database" title="Catálogo incluido" subtitle={`${BRANDS.length} marcas · ${models} modelos · 1997–2026 (listas CCA)`} />
        <ListRow icon="shield-lock" title="Privacidad" subtitle="Sin cuentas ni servidores: los datos quedan en tu teléfono." />
        <ListRow icon="github" title="Código fuente" subtitle="github.com/miguelazocar/Careful-App" onPress={() => void Linking.openURL('https://github.com/miguelazocar/Careful-App')} last />
      </Card>
      <AppText variant="caption" tone="subtle" align="center">
        Los datos técnicos del catálogo (fluidos, capacidades) son de referencia. Verificá siempre el manual de tu vehículo.
      </AppText>
    </Screen>
  );
}
