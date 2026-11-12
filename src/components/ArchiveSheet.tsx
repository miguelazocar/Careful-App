import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { FieldLabel, TextField } from '@/components/ui/inputs';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Chip } from '@/components/ui/primitives';
import type { Vehicle } from '@/db/types';
import { setVehicleArchived } from '@/db/vehicles';
import { ARCHIVE_REASONS } from '@/domain/archive';
import { toast } from '@/stores/ui';
import { spacing } from '@/theme/tokens';

/** Asks why the vehicle is no longer in use (venta, robo…) and archives it. */
export function ArchiveSheet({ vehicle, visible, onClose, onArchived }: { vehicle: Vehicle; visible: boolean; onClose: () => void; onArchived: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const archive = async () => {
    if (!reason) return toast('Elegí el motivo', 'info');
    setSaving(true);
    try {
      await setVehicleArchived(vehicle.id, { reason, note });
      toast('Vehículo archivado. Lo encontrás en «Archivados».');
      onArchived();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo archivar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Archivar ${vehicle.brand} ${vehicle.model}`}>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xs }}>
        <AppText variant="caption" tone="muted">
          Sale del garage, de la agenda y de los avisos. Todo su historial queda guardado en «Archivados», y lo podés restaurar cuando quieras.
        </AppText>
        <View>
          <FieldLabel label="¿Por qué lo archivás?" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ARCHIVE_REASONS.map((r) => (
              <Chip key={r.key} icon={r.icon} label={r.label} selected={reason === r.key} onPress={() => setReason(r.key)} />
            ))}
          </View>
        </View>
        <TextField label="Detalle" value={note} onChangeText={setNote} placeholder={reason === 'venta' ? 'Opcional, ej. vendido a Juan Pérez' : 'Opcional'} icon="text" />
        <Button label="Archivar" icon="archive-arrow-down-outline" size="lg" full loading={saving} onPress={() => void archive()} />
      </ScrollView>
    </Sheet>
  );
}
