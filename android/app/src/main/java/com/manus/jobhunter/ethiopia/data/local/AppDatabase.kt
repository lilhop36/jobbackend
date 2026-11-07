package com.manus.jobhunter.ethiopia.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [JobEntity::class, SourceEntity::class, ApplicationEntity::class, SavedJobEntity::class, CvEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun jobDao(): JobDao
    abstract fun sourceDao(): SourceDao
    abstract fun applicationDao(): ApplicationDao
    abstract fun savedJobDao(): SavedJobDao
    abstract fun cvDao(): CvDao

    companion object {
        @Volatile private var instance: AppDatabase? = null
        fun getInstance(ctx: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    ctx.applicationContext,
                    AppDatabase::class.java,
                    "jobhunter.db"
                ).fallbackToDestructiveMigration().build().also { instance = it }
            }
    }
}
