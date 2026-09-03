package com.theodoracatos.tunl

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// AlarmManager alarms don't survive a reboot, so re-arm the daily reminder on
// BOOT_COMPLETED if the player had it enabled. No-op otherwise.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            ReminderScheduler.rescheduleAfterBoot(context)
        }
    }
}
