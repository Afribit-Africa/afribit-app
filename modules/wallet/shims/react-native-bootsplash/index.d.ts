declare const RNBootSplash: {
  hide(config?: { fade?: boolean }): Promise<void>
  isVisible(): Promise<boolean>
}
export default RNBootSplash
