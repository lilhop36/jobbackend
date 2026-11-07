package com.manus.jobhunter.ethiopia.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import kotlinx.coroutines.flow.firstOrNull
import com.manus.jobhunter.ethiopia.AppContainer
import com.manus.jobhunter.ethiopia.R
import java.util.concurrent.TimeUnit

class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val c = AppContainer(applicationContext as android.app.Application)
        return try {
            c.jobs.refresh()
            c.sources.refresh()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        fun enqueue(ctx: Context, intervalHours: Long = 6) {
            val req = PeriodicWorkRequestBuilder<SyncWorker>(intervalHours, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("jh_sync", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}

class NotificationWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val c = AppContainer(applicationContext as android.app.Application)
        val now = System.currentTimeMillis()
        val d1 = now + 86_400_000L
        val apps = c.db.applicationDao().observeAll().firstOrNull() ?: emptyList()
        val nm = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel("jh_alerts", "JobHunter Alerts", NotificationManager.IMPORTANCE_DEFAULT))
        }
        for (a in apps) {
            val deadline = a.interviewDate ?: a.followUpDate
            if (deadline != null && deadline in now..d1) {
                val n = NotificationCompat.Builder(applicationContext, "jh_alerts")
                    .setSmallIcon(R.drawable.ic_launcher)
                    .setContentTitle("Upcoming: ${a.jobTitle}")
                    .setContentText("${a.employer} — reminder due soon")
                    .build()
                nm.notify(a.id.hashCode(), n)
            }
        }
        return Result.success()
    }
}
