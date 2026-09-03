package com.theodoracatos.tunl

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

// Daily-reminder local notification (TUNL 8.3). TUNL has no backend, so this is a
// purely on-device schedule: a nudge at 19:00 local on days the player hasn't
// opened the new cave yet. The JS layer (src/notify.js) owns the on/off state and
// hands over the localized text variants + a "played today" flag via the
// "notifications" bridge; this object owns the AlarmManager scheduling. Mirrors
// Tunl/Tunl/NotificationManager.swift.
object ReminderScheduler {

    const val CHANNEL_ID = "daily_reminder"
    private const val PREFS = "tunl_reminder"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_TITLES = "titles"       // "\n"-joined
    private const val KEY_BODIES = "bodies"       // "\n"-joined
    private const val KEY_NEXT_FIRE = "next_fire" // epoch millis of the next alarm
    private const val KEY_FIRES_LEFT = "fires_left"
    private const val ALARM_REQUEST = 4201
    private const val FIRE_HOUR = 19
    // Nights queued per refresh. Refreshed on every foreground (MainActivity.onResume
    // -> window._tunlReminderReschedule), so an active player is perpetually bumped
    // past all of them; a lapsed one gets exactly this many, then silence until the
    // app is opened again. The receiver decrements a counter to enforce it.
    private const val HORIZON = 3

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isEnabled(ctx: Context) = prefs(ctx).getBoolean(KEY_ENABLED, false)

    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
        val ch = NotificationChannel(
            CHANNEL_ID,
            ctx.getString(R.string.reminder_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply { description = ctx.getString(R.string.reminder_channel_desc) }
        mgr.createNotificationChannel(ch)
    }

    // Called from the "notifications" bridge on {action:"reschedule", ...} and from
    // BootReceiver (with the persisted texts). titles/bodies empty => just persist
    // the state and cancel (used by the JS disable path).
    fun reschedule(
        ctx: Context,
        enabled: Boolean,
        playedToday: Boolean,
        titles: List<String>,
        bodies: List<String>,
    ) {
        val p = prefs(ctx).edit()
        p.putBoolean(KEY_ENABLED, enabled)
        if (titles.isNotEmpty() && bodies.isNotEmpty()) {
            p.putString(KEY_TITLES, titles.joinToString("\n"))
            p.putString(KEY_BODIES, bodies.joinToString("\n"))
        }
        p.apply()

        cancelAlarm(ctx)
        if (!enabled) return

        val first = nextFireAfter(now = System.currentTimeMillis(), skipToday = playedToday)
        prefs(ctx).edit()
            .putLong(KEY_NEXT_FIRE, first)
            .putInt(KEY_FIRES_LEFT, HORIZON)
            .apply()
        ensureChannel(ctx)
        setAlarm(ctx, first)
    }

    // Called by ReminderReceiver after it posts a notification: queue the next
    // night unless the horizon is used up.
    fun scheduleNext(ctx: Context) {
        val left = prefs(ctx).getInt(KEY_FIRES_LEFT, 0) - 1
        prefs(ctx).edit().putInt(KEY_FIRES_LEFT, left).apply()
        if (left <= 0 || !isEnabled(ctx)) return
        val next = nextFireAfter(now = System.currentTimeMillis(), skipToday = true)
        prefs(ctx).edit().putLong(KEY_NEXT_FIRE, next).apply()
        setAlarm(ctx, next)
    }

    // Called by BootReceiver: alarms don't survive a reboot.
    fun rescheduleAfterBoot(ctx: Context) {
        if (!isEnabled(ctx)) return
        val stored = prefs(ctx).getLong(KEY_NEXT_FIRE, 0L)
        val fire = if (stored > System.currentTimeMillis()) stored
                   else nextFireAfter(now = System.currentTimeMillis(), skipToday = false)
        prefs(ctx).edit().putLong(KEY_NEXT_FIRE, fire).apply()
        ensureChannel(ctx)
        setAlarm(ctx, fire)
    }

    fun titles(ctx: Context) = prefs(ctx).getString(KEY_TITLES, "")?.split("\n")?.filter { it.isNotEmpty() } ?: emptyList()
    fun bodies(ctx: Context) = prefs(ctx).getString(KEY_BODIES, "")?.split("\n")?.filter { it.isNotEmpty() } ?: emptyList()

    private fun nextFireAfter(now: Long, skipToday: Boolean): Long {
        val cal = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, FIRE_HOUR)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (skipToday || cal.timeInMillis <= now + 60_000L) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }

    private fun alarmIntent(ctx: Context): PendingIntent {
        val i = Intent(ctx, ReminderReceiver::class.java)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        return PendingIntent.getBroadcast(ctx, ALARM_REQUEST, i, flags)
    }

    private fun setAlarm(ctx: Context, atMillis: Long) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // Inexact + allowed-while-idle: a reminder does not need second precision and
        // this needs no special permission (unlike setExact on Android 12+).
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, alarmIntent(ctx))
    }

    private fun cancelAlarm(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(alarmIntent(ctx))
    }
}
