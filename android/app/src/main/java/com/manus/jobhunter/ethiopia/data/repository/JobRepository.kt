package com.manus.jobhunter.ethiopia.data.repository

import com.manus.jobhunter.ethiopia.data.local.JobDao
import com.manus.jobhunter.ethiopia.data.local.JobEntity
import com.manus.jobhunter.ethiopia.data.remote.JobDto
import com.manus.jobhunter.ethiopia.data.remote.JobHunterApi
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.Locale

class JobRepository(private val api: JobHunterApi, private val dao: JobDao) {

    fun observeRecent(): Flow<List<JobEntity>> = dao.observeRecent()

    fun searchLocal(q: String?, region: String?, sector: String?): Flow<List<JobEntity>> =
        dao.search(q, region, sector)

    suspend fun getJob(id: String): JobEntity? = dao.getById(id)

    suspend fun refresh(
        q: String? = null,
        regions: String? = null,
        sectors: String? = null,
        sort: String? = null
    ): Result<Int> = runCatching {
        val res = api.searchJobs(q = q, regions = regions, sectors = sectors, sort = sort)
        val entities = res.jobs.map { it.toEntity() }
        dao.upsertAll(entities)
        entities.size
    }

    suspend fun localCount(): Int = dao.count()

    private fun JobDto.toEntity(): JobEntity {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        fun parseDate(s: String?): Long? = s?.let { runCatching { fmt.parse(it.substring(0, 19))?.time }.getOrNull() }
        return JobEntity(
            id = id,
            title = title,
            employer = employer,
            description = description ?: "",
            descriptionPlain = descriptionPlain,
            sector = sector ?: "Other",
            region = region ?: "Unknown",
            city = city,
            locationRaw = locationRaw ?: "Ethiopia",
            employmentType = employmentType ?: "FULL_TIME",
            experienceLevel = experienceLevel,
            educationLevel = educationLevel ?: "NOT_SPECIFIED",
            salaryMin = salaryMin,
            salaryMax = salaryMax,
            currency = currency ?: "ETB",
            salaryRaw = salaryRaw,
            publishedAt = parseDate(publishedAt),
            deadline = parseDate(deadline),
            lastVerifiedAt = parseDate(lastVerifiedAt) ?: System.currentTimeMillis(),
            originalUrl = originalUrl,
            applicationUrl = applicationUrl ?: originalUrl,
            applicationMethod = applicationMethod,
            applicationInstructions = applicationInstructions,
            sourceAttribution = sourceAttribution ?: "Unknown source",
            verificationStatus = verificationStatus ?: "UNVERIFIED",
            expirationStatus = expirationStatus ?: "ACTIVE"
        )
    }
}
