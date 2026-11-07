import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Vehicle } from '@/db/types';
import { formatPlate } from '@/domain/plate';
import { pickPhoto, pickPhotos, photoUri, type PickedPhoto } from '@/services/photos';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { VehiclePhoto } from './VehicleCard';
import { Sheet } from './ui/overlays';
import { AppText, Icon, ListRow } from './ui/primitives';

/** Horizontal vehicle selector — only rendered when the user has more than one vehicle. */
export function VehicleSelector({ vehicles, value, onChange }: { vehicles: Vehicle[]; value: string | null; onChange: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
      {vehicles.map((v) => {
        const active = v.id === value;
        return (
          <Pressable
            key={v.id}
            onPress={() => onChange(v.id)}
            accessibilityState={{ selected: active }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 6,
              paddingRight: 14,
              height: 56,
              borderRadius: radius.lg,
              backgroundColor: active ? colors.primarySoft : colors.surface,
              borderWidth: 2,
              borderColor: active ? colors.primary : colors.border,
            }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden' }}>
              <VehiclePhoto vehicle={v} />
            </View>
            <View>
              <AppText variant="captionStrong" numberOfLines={1}>
                {v.nickname || v.model}
              </AppText>
              <AppText variant="caption" tone="muted" style={{ fontSize: 12 }} numberOfLines={1}>
                {v.plate ? formatPlate(v.plate, v.country) : v.brand}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function PhotoSourceSheet({ visible, onClose, onPicked, multiple = 1, title = 'Agregar foto' }: { visible: boolean; onClose: () => void; onPicked: (photos: PickedPhoto[]) => void; multiple?: number; title?: string }) {
  const run = async (source: 'camera' | 'library') => {
    onClose();
    try {
      if (source === 'library' && multiple > 1) {
        const photos = await pickPhotos(multiple);
        if (photos.length) onPicked(photos);
      } else {
        const p = await pickPhoto(source);
        if (p) onPicked([p]);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar la foto', 'error');
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
        <ListRow icon="camera" title="Tomar foto" onPress={() => void run('camera')} />
        <ListRow icon="image-multiple" title={multiple > 1 ? 'Elegir de la galería' : 'Elegir una foto'} onPress={() => void run('library')} last />
      </View>
    </Sheet>
  );
}

/** Editable photo strip for records (max N). */
export function PhotoStrip({ photos, onChange, max = 8 }: { photos: string[]; onChange: (paths: string[]) => void; max?: number }) {
  const { colors } = useTheme();
  const [sheet, setSheet] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {photos.length < max ? (
          <Pressable
            onPress={() => setSheet(true)}
            style={{ width: 88, height: 88, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, gap: 2 }}>
            <Icon name="camera-plus" size={26} color={colors.primary} />
            <AppText variant="caption" tone="primary" style={{ fontSize: 12 }}>
              {photos.length ? 'Agregar' : 'Fotos'}
            </AppText>
          </Pressable>
        ) : null}
        {photos.map((p, i) => (
          <Pressable key={p} onPress={() => setViewer(i)} onLongPress={() => confirmRemove(() => onChange(photos.filter((x) => x !== p)))}>
            <Image source={{ uri: photoUri(p) ?? undefined }} style={{ width: 88, height: 88, borderRadius: radius.md }} contentFit="cover" />
            <Pressable
              onPress={() => confirmRemove(() => onChange(photos.filter((x) => x !== p)))}
              hitSlop={8}
              style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={15} color="#fff" />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
      <PhotoSourceSheet visible={sheet} onClose={() => setSheet(false)} multiple={max - photos.length} onPicked={(picked) => onChange([...photos, ...picked.map((x) => x.path)].slice(0, max))} />
      <PhotoViewer photos={photos} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

function confirmRemove(onYes: () => void) {
  Alert.alert('Quitar foto', '¿Querés quitar esta foto del registro?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Quitar', style: 'destructive', onPress: onYes },
  ]);
}

export function PhotoViewer({ photos, index, onClose }: { photos: string[]; index: number | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  if (index === null) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView horizontal pagingEnabled contentOffset={{ x: index * width, y: 0 }} showsHorizontalScrollIndicator={false}>
          {photos.map((p) => (
            <Image key={p} source={{ uri: photoUri(p) ?? undefined }} style={{ width, height }} contentFit="contain" />
          ))}
        </ScrollView>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Cerrar">
          <Icon name="close" size={26} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
