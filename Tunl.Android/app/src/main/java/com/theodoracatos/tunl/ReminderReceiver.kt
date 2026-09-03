package com.theodoracatos.tunl

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.concurrent.TimeUnit

// Fires when a scheduled daily-reminder alarm goes off (see ReminderScheduler).
// Posts one notification, rotating the localized text variant by day, then queues
// the next night unless the horizon is used up.
class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!ReminderScheduler.isEnabled(context)) return

        val titles = ReminderScheduler.titles(context)
        val bodies = ReminderScheduler.bodies(context)
        val variants = minOf(titles.size, bodies.size)
        if (variants > 0 && canPost(context)) {
            val v = (System.currentTimeMillis() / TimeUnit.DAYS.toMillis(1) % variants).toInt()
            ReminderScheduler.ensureChannel(context)

            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            val contentPi = launch?.let {
                PendingIntent.getActivity(context, 4202, it, flags)
            }

            val notif = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(titles[v])
                .setContentText(bodies[v])
                .setStyle(NotificationCompat.BigTextStyle().bigText(bodies[v]))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .apply { contentPi?.let { setContentIntent(it) } }
                .build()

            NotificationManagerCompat.from(context).notify(4200, notif)
        }

        ReminderScheduler.scheduleNext(context)
    }

    private fun canPost(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }
}
