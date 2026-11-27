import { createQrBridge } from './qrBridgeCore';

/** The shell's single pending contact-QR scan request, shared by the scan screen and the Chat host. */
export const contactScan = createQrBridge();
