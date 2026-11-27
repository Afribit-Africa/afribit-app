import React, { useCallback } from "react"
import { Linking } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { reportError } from "@app/utils/error-logging"
import { AFRIBIT_LINKS } from "@app/config/afribit-links"

import { NotificationCardUI } from "../notifications/notification-card-ui"

type SelfCustodialInfoBulletinProps = {
  onDismiss: () => void
}

export const SelfCustodialInfoBulletin: React.FC<SelfCustodialInfoBulletinProps> = ({
  onDismiss,
}) => {
  const { LL } = useI18nContext()
  const articleUrl = AFRIBIT_LINKS.nonCustodialArticle

  const handleAction = useCallback(async () => {
    onDismiss()
    try {
      await Linking.openURL(articleUrl)
    } catch (err) {
      reportError("Open self-custodial info bulletin link", err)
    }
  }, [onDismiss, articleUrl])

  return (
    <NotificationCardUI
      title={LL.NonCustodialInfoBulletin.title()}
      text={articleUrl ? LL.NonCustodialInfoBulletin.body() : undefined}
      action={articleUrl ? handleAction : undefined}
      dismissAction={onDismiss}
      buttonLabel={articleUrl ? LL.NonCustodialInfoBulletin.cta() : undefined}
    />
  )
}
