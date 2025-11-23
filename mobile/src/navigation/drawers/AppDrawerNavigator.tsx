import React from 'react';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
import MiningScreen from '../../screens/MiningScreen';
import DepositScreen from '../../screens/DepositScreen';
import WithdrawScreen from '../../screens/WithdrawScreen';
import TaskScreen from '../../screens/TaskScreen';
import TeamScreen from '../../screens/TeamScreen';
import ListCoinScreen from '../../screens/ListCoinScreen';
import EWalletScreen from '../../screens/EWalletScreen';
import HistoryScreen from '../../screens/HistoryScreen';
import SupportScreen from '../../screens/SupportScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import FaqsScreen from '../../screens/FaqsScreen';
import AdminPanelScreen from '../../screens/AdminPanelScreen';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { colors, spacing } from '../../styles/theme';
import { Icon } from '../../components/Icon';

export type DrawerParamList = {
  Home: undefined;
  Mining: undefined;
  Deposit: undefined;
  Withdraw: undefined;
  Tasks: undefined;
  Team: undefined;
  Coins: undefined;
  EWallet: undefined;
  History: undefined;
  Support: undefined;
  Profile: undefined;
  FAQs: undefined;
  AdminPanel: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

const CustomDrawerContent = (props: any) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={styles.header}>
        <Text style={styles.brand}>MintMinePro</Text>
        <Text style={styles.userText}>{user?.email ?? 'Guest'}</Text>
      </View>
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionText}>Main</Text>
      </View>
      {props.state.routeNames.map((name: string) => {
        if (name === 'AdminPanel' && !user?.isAdmin) return null;
        return (
          <DrawerItem
            key={name}
            label={({ color }) => <Text style={[styles.itemText, { color }]}>{name}</Text>}
            icon={({ color, size }) => <Icon name="menu" color={color} size={size} />}
            onPress={() => props.navigation.navigate(name)}
          />
        );
      })}
      <DrawerItem
        label="Logout"
        icon={({ color, size }) => <Icon name="log-out" color={color} size={size} />}
        onPress={() => dispatch(logout())}
      />
    </DrawerContentScrollView>
  );
};

const AppDrawerNavigator = () => {
  const user = useAppSelector((state) => state.auth.user);
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ headerShown: true }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Mining" component={MiningScreen} />
      <Drawer.Screen name="Deposit" component={DepositScreen} />
      <Drawer.Screen name="Withdraw" component={WithdrawScreen} />
      <Drawer.Screen name="Tasks" component={TaskScreen} />
      <Drawer.Screen name="Team" component={TeamScreen} />
      <Drawer.Screen name="Coins" component={ListCoinScreen} />
      <Drawer.Screen name="EWallet" component={EWalletScreen} />
      <Drawer.Screen name="History" component={HistoryScreen} />
      <Drawer.Screen name="Support" component={SupportScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="FAQs" component={FaqsScreen} />
      {user?.isAdmin && <Drawer.Screen name="AdminPanel" component={AdminPanelScreen} />}
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
    paddingVertical: spacing.lg
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary
  },
  userText: {
    color: colors.textMuted,
    marginTop: spacing.xs
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  sectionText: {
    color: colors.textMuted,
    fontWeight: '600'
  },
  itemText: {
    fontSize: 16
  }
});

export default AppDrawerNavigator;
