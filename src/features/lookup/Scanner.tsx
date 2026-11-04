// The Barcode tab's camera. It runs only while mounted: the tab unmounts it when a scan lands, on
// Cancel, and on leaving the tab. expo-camera stops the session in the background and restarts it
// on return, so a closed scanner never restarts. Frames are read, never stored.
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, View } from 'react-native';

import { Button, Label, Row, usePalette } from '../../ui';
import { expandUpcE } from '../foods/foods';

// Package barcodes only. expo-camera reports UPC-A as 12 digits and UPC-E as 8 compressed ones.
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];
// expo-camera restarts the session itself after a media reset, then reports this anyway.
const RECOVERED = 'Camera session was reset';

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <View accessibilityRole="alert" style={{ gap: 8 }}>
    <Label accessibilityRole="header">{title}</Label>
    <Label size={12} muted>{text}</Label>
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>{children}</Row>
  </View>;
}

/** Asks for camera access when opened, then reports the first barcode it reads, once per opening. */
export function Scanner({ onScan, onCancel }: { onScan: (code: string) => void; onCancel: () => void }) {
  const p = usePalette();
  const [permission, request, reread] = useCameraPermissions();
  const [failed, setFailed] = useState(false);
  // The camera calls back for every frame that shows the code, before the tab can unmount it.
  const scanned = useRef(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain || asked) return;
    setAsked(true);
    request();
  }, [permission, request, asked]);
  // The hook reads permission only on mount; access may change in Settings while the app is away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => state === 'active' && reread());
    return () => sub.remove();
  }, [reread]);

  const cancel = <Button onPress={onCancel}>Cancel</Button>;
  if (failed) return <Message title="The camera couldn't start"
    text="Cancel and tap ▥ to try again, or type the digits printed under the barcode below.">{cancel}</Message>;
  // Undetermined while the iOS prompt is open: wait behind it rather than reporting access off.
  if (permission?.status === 'denied') {
    return <Message title="Camera access is off" text={permission.canAskAgain
      ? 'Allow camera access to scan, or type the digits printed under the barcode below.'
      : 'To scan, open Settings, tap Nutrition diary, and turn on Camera. You can type the digits below meanwhile.'}>
      {permission.canAskAgain
        ? <Button primary onPress={request}>Allow camera</Button>
        : <Button primary onPress={() => Linking.openSettings()}>Open Settings</Button>}
      {cancel}
    </Message>;
  }
  // ponytail: iOS has no expo-camera call that reports a missing camera, so the Simulator shows an
  // empty square; add a check if a camera-less device ever becomes a target.
  return <View style={{ gap: 12 }}>
    <View style={{ aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: p.field }}>
      {permission?.granted ? <CameraView style={{ flex: 1 }} facing="back" accessibilityLabel="Barcode camera"
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }} onMountError={({ message }) => message !== RECOVERED && setFailed(true)}
        onBarcodeScanned={({ type, data }) => {
          if (scanned.current) return;
          scanned.current = true;
          onScan(type === 'upc_e' ? expandUpcE(data) : data);
        }} /> : null}
    </View>
    <Row style={{ gap: 8 }}>
      <Label size={12} muted style={{ flex: 1 }} accessibilityLiveRegion="polite">
        Hold the barcode inside the square. If it won't read, type the digits below.
      </Label>
      {cancel}
    </Row>
  </View>;
}
