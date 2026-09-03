import Foundation
import UserNotifications

// Daily-reminder local notification (TUNL 8.3). TUNL has no backend, so this is a
// purely on-device schedule: a nudge at 19:00 local on days the player hasn't
// opened the new cave yet. The JS layer (src/notify.js) owns the on/off state and
// hands over the localized text variants + a "played today" flag; this type owns
// the scheduling. Mirrors Tunl.Android/.../ReminderScheduler.kt.
final class NotificationManager {

    private let center = UNUserNotificationCenter.current()
    private static let idPrefix = "tunl.daily."
    private static let fireHour = 19
    // How many nights to queue at once. Refreshed on every foreground (GameView's
    // didBecomeActive -> window._tunlReminderReschedule), so an active player is
    // perpetually pushed past all of them and a lapsed one gets exactly this many
    // nudges, then silence until the app is opened again.
    private static let horizon = 3

    // {action:"requestPermission"} - GameView wires `completion` to
    // window._tunlNotifPermission. Reports the current decision either way (a prior
    // hard "Don't Allow" comes back as false without a second prompt).
    func requestPermission(_ completion: @escaping (Bool) -> Void) {
        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            switch settings.authorizationStatus {
            case .authorized, .provisional:
                DispatchQueue.main.async { completion(true) }
            case .denied:
                DispatchQueue.main.async { completion(false) }
            default:
                self.center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                    DispatchQueue.main.async { completion(granted) }
                }
            }
        }
    }

    // {action:"reschedule", enabled, playedToday, titles:[3], bodies:[3]}
    func reschedule(enabled: Bool, playedToday: Bool, titles: [String], bodies: [String]) {
        let ids = (0..<Self.horizon).map { Self.idPrefix + "\($0)" }
        center.removePendingNotificationRequests(withIdentifiers: ids)

        let variants = min(titles.count, bodies.count)
        guard enabled, variants > 0 else { return }

        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            guard settings.authorizationStatus == .authorized
               || settings.authorizationStatus == .provisional else { return }

            let cal = Calendar.current
            let now = Date()
            var first = cal.date(bySettingHour: Self.fireHour, minute: 0, second: 0, of: now)
                ?? now.addingTimeInterval(3600)
            // Skip tonight if 19:00 has passed (or is within a minute) or the player
            // already flew today's cave.
            if playedToday || first <= now.addingTimeInterval(60) {
                first = cal.date(byAdding: .day, value: 1, to: first) ?? first.addingTimeInterval(86400)
            }

            for i in 0..<Self.horizon {
                guard let fireDate = cal.date(byAdding: .day, value: i, to: first) else { continue }
                let dayIndex = cal.ordinality(of: .day, in: .era, for: fireDate) ?? i
                let v = dayIndex % variants

                let content = UNMutableNotificationContent()
                content.title = titles[v]
                content.body  = bodies[v]
                content.sound = .default

                let trigger: UNNotificationTrigger
                #if DEBUG
                // TESTING ONLY: debug builds fire a few seconds out instead of at
                // 19:00 so the flow is testable in the Simulator without waiting or
                // moving the clock. Compiled out of release builds entirely.
                trigger = UNTimeIntervalNotificationTrigger(timeInterval: Double(15 * (i + 1)), repeats: false)
                #else
                let comps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                #endif
                self.center.add(UNNotificationRequest(identifier: Self.idPrefix + "\(i)",
                                                      content: content, trigger: trigger))
            }
        }
    }
}
