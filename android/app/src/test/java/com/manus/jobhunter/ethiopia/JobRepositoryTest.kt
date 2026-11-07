package com.manus.jobhunter.ethiopia

import com.manus.jobhunter.ethiopia.data.local.JobDao
import com.manus.jobhunter.ethiopia.data.local.JobEntity
import com.manus.jobhunter.ethiopia.data.remote.*
import com.manus.jobhunter.ethiopia.data.repository.JobRepository
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class JobRepositoryTest {

    @Test
    fun `refresh fetches remote jobs and upserts entities into dao`() = runTest {
        val api = mockk<JobHunterApi>()
        val dao = mockk<JobDao>(relaxed = true)
        val dto = JobDto(
            id = "1",
            title = "Frontend Developer",
            employer = "Tech PLC",
            employerWebsite = null,
            description = "Build UI",
            descriptionPlain = "Build UI",
            sector = "ICT & Software",
            region = "Addis Ababa",
            city = "Addis Ababa",
            locationRaw = "Addis Ababa",
            employmentType = "FULL_TIME",
            experienceLevel = "2+ years",
            educationLevel = "BACHELOR",
            salaryMin = null,
            salaryMax = null,
            currency = "ETB",
            salaryRaw = null,
            publishedAt = "2026-11-01T00:00:00Z",
            deadline = null,
            lastVerifiedAt = null,
            originalUrl = "https://example.com/job/1",
            applicationUrl = null,
            applicationMethod = "URL",
            applicationInstructions = null,
            sourceAttribution = "Test Source",
            verificationStatus = "UNVERIFIED",
            expirationStatus = "ACTIVE",
            riskFlags = null
        )
        coEvery { api.searchJobs(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()) } returns
            JobSearchResultDto(jobs = listOf(dto), total = 1, hasMore = false, nextCursor = null)
        coEvery { dao.count() } returns 1

        val repo = JobRepository(api, dao)
        val res = repo.refresh()

        assertTrue(res.isSuccess)
        assertEquals(1, res.getOrNull())
        coVerify(exactly = 1) { dao.upsertAll(match { it.size == 1 && it[0].title == "Frontend Developer" }) }
    }

    @Test
    fun `observeRecent delegates to dao flow`() = runTest {
        val api = mockk<JobHunterApi>()
        val dao = mockk<JobDao>()
        every { dao.observeRecent(any()) } returns flowOf(emptyList())

        val repo = JobRepository(api, dao)
        repo.observeRecent()

        verify(exactly = 1) { dao.observeRecent(any()) }
    }
}
