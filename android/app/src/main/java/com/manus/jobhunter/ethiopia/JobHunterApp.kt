package com.manus.jobhunter.ethiopia

import android.app.Application
import com.manus.jobhunter.ethiopia.data.local.AppDatabase
import com.manus.jobhunter.ethiopia.data.remote.NetworkModule
import com.manus.jobhunter.ethiopia.data.repository.*

class JobHunterApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

class AppContainer(app: Application) {
    val db: AppDatabase = AppDatabase.getInstance(app)
    val api = NetworkModule.create()

    val jobs = JobRepository(api, db.jobDao())
    val sources = SourceRepository(api, db.sourceDao())
    val applications = ApplicationRepository(api, db.applicationDao())
    val saved = SavedJobRepository(api, db.savedJobDao())
    val cv = CvRepository(api, db.cvDao())
    val ai = AiRepository(api)
    val prefs = PreferencesRepository(app)
}
