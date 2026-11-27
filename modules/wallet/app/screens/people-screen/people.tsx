import * as React from "react"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { ContactsCard } from "./contacts/contacts-card"

export const PeopleScreen: React.FC = () => {
  const styles = useStyles()

  return (
    <Screen
      style={styles.screen}
      preset="scroll"
      headerShown={false}
      edges={["top", "left", "right"]}
    >
      <ContactsCard />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  screen: {
    padding: 20,
  },
}))
