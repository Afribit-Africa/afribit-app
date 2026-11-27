// Seeded admission-check violations. This file is never bundled.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBroker } from '@afribit/kernel';
import { NativeModules } from 'react-native';
import * as walletInternals from '../../../../features/wallet/src';

const name = 'x';
export const leaked = [AsyncStorage, createBroker, NativeModules.RNCKeychain, walletInternals, eval('1'), require(name)];
