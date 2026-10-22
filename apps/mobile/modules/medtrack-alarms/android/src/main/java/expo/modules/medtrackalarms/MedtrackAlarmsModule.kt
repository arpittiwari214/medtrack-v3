package expo.modules.medtrackalarms

import android.app.AlarmManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The two reminder-reliability questions expo-notifications cannot answer.
 *
 * expo-notifications decides exact versus inexact alarms internally
 * (ExpoSchedulingDelegate) and never tells JavaScript which it chose, so an app
 * whose exact-alarm permission is denied — the default on Android 14+ — fires
 * every reminder late without any signal. Battery-optimisation state is
 * similarly invisible. This module only reads those two facts and opens the
 * screens where the patient can change them; it schedules nothing itself.
 */
class MedtrackAlarmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("MedtrackAlarms")

    Function("canScheduleExactAlarms") {
      // Before Android 12 exact alarms needed no permission.
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@Function true
      }
      val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      return@Function alarms.canScheduleExactAlarms()
    }

    Function("isIgnoringBatteryOptimizations") {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      return@Function power.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@Function false
      }
      return@Function launch(
        Intent(
          Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context.packageName}")
        )
      )
    }

    Function("openBatteryOptimizationSettings") {
      // The list screen, not ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: the
      // direct request needs a permission Google Play restricts to a short
      // list of app categories, and a medication reminder is not on it.
      return@Function launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    Function("openAutostartSettings") {
      // Vendor screens are undocumented and move between OS versions, so try
      // the known ones in order and fall back to this app's own info page,
      // where every vendor exposes battery and background controls.
      for (component in AUTOSTART_SCREENS) {
        if (launch(Intent().setComponent(component))) {
          return@Function true
        }
      }
      return@Function launch(appDetailsIntent())
    }

    Function("openAppDetails") {
      return@Function launch(appDetailsIntent())
    }
  }

  private fun appDetailsIntent() =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))

  private fun launch(intent: Intent): Boolean {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      // Missing activity on this vendor/version, or the vendor refuses
      // third-party launches. Either way the caller falls back.
      false
    }
  }

  companion object {
    private val AUTOSTART_SCREENS = listOf(
      // Xiaomi / Redmi / POCO (MIUI, HyperOS)
      ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      // OPPO / realme / OnePlus (ColorOS lineage)
      ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
      ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
      ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
      // vivo (Funtouch OS, OriginOS)
      ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
      ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
      // Samsung (One UI) battery screen, home of "never sleeping apps"
      ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"),
    )
  }
}
