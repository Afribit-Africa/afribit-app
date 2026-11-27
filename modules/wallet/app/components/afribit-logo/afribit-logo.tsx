import * as React from "react"
import { Image, View } from "react-native"

import { fonts } from "@app/rne-theme/fonts"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import Symbol from "../../assets/logo/afribit-symbol.png"

/** The symbol is 394×396, so `size` (its height) leaves the width a hair smaller. */
const SYMBOL_ASPECT_RATIO = 394 / 396
/** Keeps the wordmark's size in proportion to the symbol it accompanies. */
const WORDMARK_SIZE_RATIO = 0.4

export type AfribitLogoProps = {
  size: number
  wordmark?: "none" | "right" | "below"
  testID?: string
}

export const AfribitLogo: React.FC<AfribitLogoProps> = ({
  size,
  wordmark = "none",
  testID,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const showWordmark = wordmark !== "none"

  return (
    <View
      style={[
        styles.container,
        wordmark === "right" && styles.containerRight,
        wordmark === "below" && styles.containerBelow,
      ]}
      testID={testID}
    >
      <Image
        source={Symbol}
        style={{ height: size, width: size * SYMBOL_ASPECT_RATIO }}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Afribit"
      />
      {showWordmark && (
        <Text
          style={[
            styles.wordmark,
            { fontSize: size * WORDMARK_SIZE_RATIO, color: colors.textPrimary },
          ]}
        >
          Afribit
        </Text>
      )}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    alignItems: "center",
  },
  containerRight: {
    flexDirection: "row",
    columnGap: 8,
  },
  containerBelow: {
    flexDirection: "column",
    rowGap: 8,
  },
  wordmark: {
    fontFamily: fonts.bold,
  },
}))
