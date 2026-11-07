package com.manus.jobhunter.ethiopia.data.local

import androidx.room.*
import androidx.paging.PagingSource
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "jobs")
data class JobEntity(
    @PrimaryKey val id: String,
    val title: String,
    val employer: String,
    val description: String,
    val descriptionPlain: String?,
    val sector: String,
    val region: String,
    val city: String?,
    val locationRaw: String,
    val employmentType: String,
    val experienceLevel: String?,
    val educationLevel: String,
    val salaryMin: Double?,
    val salaryMax: Double?,
    val currency: String,
    val salaryRaw: String?,
    val publishedAt: Long?,
    val deadline: Long?,
    val lastVerifiedAt: Long,
    val originalUrl: String,
    val applicationUrl: String?,
    val applicationMethod: String?,
    val applicationInstructions: String?,
    val sourceAttribution: String,
    val verificationStatus: String,
    val expirationStatus: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Dao
interface JobDao {
    @Query("SELECT * FROM jobs WHERE expirationStatus = 'ACTIVE' ORDER BY publishedAt DESC LIMIT :limit")
    fun observeRecent(limit: Int = 50): Flow<List<JobEntity>>

    @Query("SELECT * FROM jobs WHERE id = :id")
    suspend fun getById(id: String): JobEntity?

    @Query("""
        SELECT * FROM jobs WHERE expirationStatus != 'EXPIRED'
        AND (:q IS NULL OR title LIKE '%' || :q || '%' OR employer LIKE '%' || :q || '%' OR description LIKE '%' || :q || '%')
        AND (:region IS NULL OR region = :region)
        AND (:sector IS NULL OR sector = :sector)
        ORDER BY publishedAt DESC
    """)
    fun search(q: String?, region: String?, sector: String?): Flow<List<JobEntity>>

    @Query("SELECT COUNT(*) FROM jobs")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(jobs: List<JobEntity>)

    @Query("DELETE FROM jobs WHERE id = :id")
    suspend fun deleteById(id: String)
}

@Entity(tableName = "sources")
data class SourceEntity(
    @PrimaryKey val id: String,
    val name: String,
    val type: String,
    val baseUrl: String,
    val enabled: Boolean,
    val ok: Boolean,
    val lastSyncAt: Long?,
    val lastSyncStatus: String?,
    val jobCount: Int
)

@Dao
interface SourceDao {
    @Query("SELECT * FROM sources ORDER BY name ASC")
    fun observeAll(): Flow<List<SourceEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(sources: List<SourceEntity>)

    @Query("UPDATE sources SET enabled = :enabled WHERE id = :id")
    suspend fun setEnabled(id: String, enabled: Boolean)
}

@Entity(tableName = "applications")
data class ApplicationEntity(
    @PrimaryKey val id: String,
    val jobId: String?,
    val employer: String,
    val jobTitle: String,
    val status: String,
    val appliedAt: Long?,
    val cvVersion: String?,
    val followUpDate: Long?,
    val interviewDate: Long?,
    val notes: String?,
    val updatedAt: Long = System.currentTimeMillis()
)

@Dao
interface ApplicationDao {
    @Query("SELECT * FROM applications ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<ApplicationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(app: ApplicationEntity)

    @Query("DELETE FROM applications WHERE id = :id")
    suspend fun deleteById(id: String)
}

@Entity(tableName = "saved_jobs", primaryKeys = ["jobId"])
data class SavedJobEntity(
    val jobId: String,
    val notes: String?,
    val savedAt: Long = System.currentTimeMillis()
)

@Dao
interface SavedJobDao {
    @Query("SELECT * FROM saved_jobs ORDER BY savedAt DESC")
    fun observeAll(): Flow<List<SavedJobEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM saved_jobs WHERE jobId = :jobId)")
    fun observeIsSaved(jobId: String): Flow<Boolean>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(sj: SavedJobEntity)

    @Query("DELETE FROM saved_jobs WHERE jobId = :jobId")
    suspend fun remove(jobId: String)
}

@Entity(tableName = "cv_profiles")
data class CvEntity(
    @PrimaryKey val id: String,
    val title: String,
    val fullName: String?,
    val email: String?,
    val phone: String?,
    val location: String?,
    val rawText: String?,
    val jsonPayload: String?,
    val isDefault: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

@Dao
interface CvDao {
    @Query("SELECT * FROM cv_profiles ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<CvEntity>>

    @Query("SELECT * FROM cv_profiles WHERE id = :id")
    suspend fun getById(id: String): CvEntity?

    @Query("SELECT * FROM cv_profiles WHERE isDefault = 1 LIMIT 1")
    suspend fun getDefault(): CvEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(cv: CvEntity)

    @Query("DELETE FROM cv_profiles WHERE id = :id")
    suspend fun deleteById(id: String)
}
