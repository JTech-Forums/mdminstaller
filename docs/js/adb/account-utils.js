export async function isDeviceRooted(adb) {
  if (!adb) return false;
  try {
    const outputs = [];
    try {
      const out = await adb.executeShellCommand('which su');
      if (out && out.trim().includes('/su') && !/not found|permission denied/i.test(out)) outputs.push(out);
    } catch {}
    try {
      const out = await adb.executeShellCommand('whoami');
      if (out && out.trim().toLowerCase() === 'root' && !/permission denied/i.test(out)) outputs.push(out);
    } catch {}
    try {
      const out = await adb.executeShellCommand('pm list packages');
      if (out && /com\.topjohnwu\.magisk|eu\.chainfire\.supersu/i.test(out)) outputs.push(out);
    } catch {}
    return outputs.length > 0;
  } catch {
    return false;
  }
}

export async function isAndroid14OrHigher(adb) {
  if (!adb) return false;
  try {
    const apiLevel = await adb.executeShellCommand('getprop ro.build.version.sdk');
    const level = parseInt(apiLevel.trim(), 10);
    return !isNaN(level) && level >= 34;
  } catch {
    return false;
  }
}

export async function deviceHasAccounts(adb) {
  if (!adb) return false;
  const outputs = [];
  const cmds = [
    'cmd account list --user 0',
    'cmd account list',
    'dumpsys account',
    'cmd accounts list',
  ];
  for (const cmd of cmds) {
    try {
      const out = await adb.executeShellCommand(cmd);
      if (out && out.trim()) outputs.push(out);
    } catch {}
  }
  const out = outputs.join('\n\n').trim();
  if (!out) return false;
  const lower = out.toLowerCase();
  if (/accounts?\s*:\s*(\d+)/.test(lower)) {
    const n = parseInt(RegExp.$1, 10);
    if (!isNaN(n)) return n > 0;
  }
  if (/account\s*\{?\s*name\s*=/.test(lower)) return true;
  if (/type=/.test(lower) && /name=/.test(lower)) return true;
  if (/@[a-z0-9._%+-]+(?:\.[a-z0-9._%+-]+)+/i.test(out)) return true;
  if (/com\.google|whatsapp|facebook|telegram|samsung|microsoft|work|exchange|corp/i.test(out)) return true;
  if (/no accounts/i.test(lower)) return false;
  if (/accounts?:/.test(out) && /accounts?:[^\n]*\n[ \t]+\S+/i.test(out)) return true;
  return false;
}

export async function disableAccountApps(adb) {
  if (!adb) return [];

  const disabled = new Set();
  const packagesToDisable = new Set([
    'com.microsoft.office.officehubrow',
    'com.microsoft.office.word',
    'com.microsoft.office.excel',
    'com.microsoft.office.outlook',
    'com.microsoft.office.powerpoint',
    'com.microsoft.skydrive',
    'com.microsoft.appmanager',
    'com.facebook.katana',
    'com.facebook.orca',
    'com.whatsapp',
    'com.google.android.gm',
    'com.google.android.gsf.login',
    'com.google.android.gms',
    'com.samsung.android.mobileservice',
  ]);

  const addPackage = pkg => {
    if (!pkg) return;
    const clean = pkg.trim();
    if (!clean || clean === 'android') return;
    if (!/^[a-zA-Z0-9_.]+$/.test(clean)) return;
    packagesToDisable.add(clean);
  };

  const accountTypePackageMap = {
    'com.google': ['com.google.android.gsf.login', 'com.google.android.gms'],
    'com.google.work': ['com.google.android.gm', 'com.google.android.gsf.login', 'com.google.android.gms'],
    'com.google.android.gm.exchange': ['com.google.android.gm'],
    'com.android.exchange': ['com.google.android.gm'],
    'com.microsoft.exchange': ['com.microsoft.office.outlook'],
    'com.microsoft.workaccount': ['com.microsoft.appmanager'],
    'com.facebook.auth.login': ['com.facebook.katana', 'com.facebook.orca'],
    'com.whatsapp': ['com.whatsapp'],
    'com.samsung.android.mobileservice': ['com.samsung.android.mobileservice'],
  };

  const commands = [
    'cmd account list --user 0',
    'cmd account list',
    'dumpsys account',
  ];

  const outputs = [];
  for (const cmd of commands) {
    try {
      const out = await adb.executeShellCommand(cmd);
      if (out && out.trim()) outputs.push(out);
    } catch (e) {
      console.log(`command ${cmd} failed`, e?.message || e);
    }
  }

  const combined = outputs.join('\n\n');
  const componentRegex = /ComponentInfo\{([^\/}]+)\/[^}]+\}/g;
  let match;
  while ((match = componentRegex.exec(combined))) {
    addPackage(match[1]);
  }

  const packageRegex = /packageName=([a-zA-Z0-9_.]+)/g;
  while ((match = packageRegex.exec(combined))) {
    addPackage(match[1]);
  }

  const authenticatorRegex = /AuthenticatorDescription \{([^}]+)\}/g;
  while ((match = authenticatorRegex.exec(combined))) {
    const block = match[1];
    const typeMatch = /type=([^,\s]+)/.exec(block);
    const packageMatch = /packageName=([^,\s]+)/.exec(block);
    if (packageMatch) addPackage(packageMatch[1]);
    if (typeMatch && accountTypePackageMap[typeMatch[1]]) {
      for (const pkg of accountTypePackageMap[typeMatch[1]]) addPackage(pkg);
    }
  }

  const typeRegex = /type[=:\s]+([^,\s]+)/g;
  const accountTypes = new Set();
  while ((match = typeRegex.exec(combined))) {
    const type = match[1]?.trim();
    if (type) accountTypes.add(type);
  }
  for (const type of accountTypes) {
    const mapped = accountTypePackageMap[type];
    if (mapped) {
      for (const pkg of mapped) addPackage(pkg);
    }
  }

  const run = async pkg => {
    if (disabled.has(pkg)) return;
    try {
      await adb.executeShellCommand(`pm disable-user --user 0 ${pkg}`);
      disabled.add(pkg);
      console.log('disabled', pkg);
    } catch (e) {
      console.log('failed to disable', pkg, e?.message || e);
    }
  };

  for (const pkg of packagesToDisable) {
    await run(pkg);
  }

  // Give the system a brief moment to acknowledge the disabled authenticators
  if (disabled.size > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return Array.from(disabled);
}

export async function reenablePackages(adb, packages) {
  if (!adb || !packages?.length) return;
  console.log('reenablePackages', packages);
  for (const pkg of packages) {
    try {
      await adb.executeShellCommand(`pm enable --user 0 ${pkg}`);
      console.log('reenabled', pkg);
    } catch (e) {
      console.log('failed to reenable', pkg);
    }
  }
}

export async function runShellCommand(adb, cmd) {
  const c = Array.isArray(cmd) ? cmd.join(' ') : cmd;
  return await adb.executeShellCommand(c);
}
