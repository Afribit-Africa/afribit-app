import React from "react"
import { Linking } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"

import { SelfCustodialInfoBulletin } from "@app/components/self-custodial-info-bulletin"
import { reportError } from "@app/utils/error-logging"

const ARTICLE_URL = "https://afribit.africa/blog/non-custodial-accounts"

let mockArticleUrl = ""

jest.mock("@app/config/afribit-links", () => ({
  AFRIBIT_LINKS: {
    get nonCustodialArticle() {
      return mockArticleUrl
    },
  },
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    textMuted: "#999",
    surfaceInteractive: "#f5f5f5",
    accent: "#007",
    textOnBackground: "#000",
    backgroundDefault: "#fff",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ onPress }: { onPress: () => void }) =>
    React.createElement("Pressable", { onPress, testID: "dismiss-button" }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "cta-button" },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      NonCustodialInfoBulletin: {
        title: () => "This is a non-custodial account",
        body: () => "To learn more read our blog post",
        cta: () => "Read",
      },
    },
  }),
}))

describe("SelfCustodialInfoBulletin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockArticleUrl = ""
    jest.spyOn(Linking, "openURL").mockResolvedValue(true)
  })

  it("shows the title but no Read button or learn-more line when there is no article", () => {
    const { getByText, queryByText, queryByTestId } = render(
      <SelfCustodialInfoBulletin onDismiss={jest.fn()} />,
    )

    expect(getByText("This is a non-custodial account")).toBeTruthy()
    expect(queryByText("To learn more read our blog post")).toBeNull()
    expect(queryByText("Read")).toBeNull()
    expect(queryByTestId("cta-button")).toBeNull()
  })

  it("shows the learn-more line and the Read button when an article is set", () => {
    mockArticleUrl = ARTICLE_URL
    const { getByText } = render(<SelfCustodialInfoBulletin onDismiss={jest.fn()} />)

    expect(getByText("To learn more read our blog post")).toBeTruthy()
    expect(getByText("Read")).toBeTruthy()
  })

  it("calls onDismiss when the close button is pressed", () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(<SelfCustodialInfoBulletin onDismiss={onDismiss} />)

    fireEvent.press(getByTestId("dismiss-button"))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("opens the article and dismisses when the Read button is pressed", async () => {
    mockArticleUrl = ARTICLE_URL
    const onDismiss = jest.fn()
    const { getByTestId } = render(<SelfCustodialInfoBulletin onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByTestId("cta-button"))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(Linking.openURL).toHaveBeenCalledWith(ARTICLE_URL)
  })

  it("still dismisses and reports the error when opening the article fails", async () => {
    mockArticleUrl = ARTICLE_URL
    ;(Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error("no handler"))
    const onDismiss = jest.fn()
    const { getByTestId } = render(<SelfCustodialInfoBulletin onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByTestId("cta-button"))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      "Open self-custodial info bulletin link",
      expect.any(Error),
    )
  })
})
