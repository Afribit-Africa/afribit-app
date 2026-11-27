import * as React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider, createTheme } from "@rn-vui/themed"

import { AfribitLogo } from "@app/components/afribit-logo"
import { dark, light } from "@app/rne-theme/colors"
import { fonts } from "@app/rne-theme/fonts"
import theme from "@app/rne-theme/theme"

const renderLogo = (ui: React.ReactElement, mode: "light" | "dark" = "light") =>
  render(
    <ThemeProvider
      theme={
        mode === "light"
          ? theme
          : createTheme({ lightColors: light, darkColors: dark, mode: "dark" })
      }
    >
      {ui}
    </ThemeProvider>,
  )

describe("AfribitLogo", () => {
  it("renders the symbol at the requested height with its Afribit label", () => {
    const { getByLabelText } = renderLogo(<AfribitLogo size={120} />)

    const symbol = getByLabelText("Afribit")
    expect(symbol.props.accessibilityRole).toBe("image")

    const style = StyleSheet.flatten(symbol.props.style)
    expect(style.height).toBe(120)
    expect(style.width).toBeCloseTo(120 * (394 / 396))
  })

  it("shows no wordmark unless one is asked for", () => {
    const { queryByText } = renderLogo(<AfribitLogo size={80} />)

    expect(queryByText("Afribit")).toBeNull()
  })

  it("shows the wordmark beside the symbol in the theme's bold face", () => {
    const { getByText } = renderLogo(<AfribitLogo size={80} wordmark="right" />)

    const style = StyleSheet.flatten(getByText("Afribit").props.style)
    expect(style.fontFamily).toBe(fonts.bold)
    expect(style.color).toBe(light.textPrimary)
  })

  it("shows the wordmark below the symbol when asked", () => {
    const { getByText } = renderLogo(<AfribitLogo size={80} wordmark="below" />)

    expect(getByText("Afribit")).toBeTruthy()
  })

  it("keeps the wordmark in the dark theme's primary text colour", () => {
    const { getByText } = renderLogo(<AfribitLogo size={80} wordmark="right" />, "dark")

    const style = StyleSheet.flatten(getByText("Afribit").props.style)
    expect(style.color).toBe(dark.textPrimary)
  })
})
