const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Removes the `aps-environment` entitlement that expo-notifications always adds.
 *
 * Free (personal) Apple teams cannot sign the Push Notifications capability. This app only
 * schedules local notifications, which do not need it. Remove this plugin from app.json once
 * the app is signed by a paid team and remote push is wanted.
 *
 * Order matters: mods run in reverse registration order, so this must be listed BEFORE
 * expo-notifications in app.json for its delete to run after that plugin's insert.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
