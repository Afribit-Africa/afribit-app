import { AFRIBIT_LINKS } from "@app/config/afribit-links"

const EMAIL_KEYS = ["supportEmail", "feedbackEmail"]

describe("AFRIBIT_LINKS", () => {
  it("is a frozen object", () => {
    expect(Object.isFrozen(AFRIBIT_LINKS)).toBe(true)
  })

  it("holds every public link and contact key", () => {
    expect(Object.keys(AFRIBIT_LINKS).sort()).toEqual(
      [
        "blog",
        "blockedCountriesFaq",
        "faq",
        "feedbackEmail",
        "nonCustodialArticle",
        "privacyPolicy",
        "supportEmail",
        "termsAndConditions",
        "website",
        "whatsAppSupport",
      ].sort(),
    )
  })

  it("has an https URL or an empty string for every link", () => {
    const links = Object.entries(AFRIBIT_LINKS).filter(
      ([key]) => !EMAIL_KEYS.includes(key),
    )
    for (const [, value] of links) {
      expect(value === "" || value.startsWith("https://")).toBe(true)
    }
  })

  it("has a plain address or an empty string for every email", () => {
    const emails = Object.entries(AFRIBIT_LINKS).filter(([key]) =>
      EMAIL_KEYS.includes(key),
    )
    for (const [, value] of emails) {
      expect(value === "" || /^[^\s@]+@[^\s@]+$/.test(value)).toBe(true)
    }
  })
})
