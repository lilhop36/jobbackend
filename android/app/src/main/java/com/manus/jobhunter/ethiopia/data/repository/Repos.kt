package com.manus.jobhunter.ethiopia.data.repository

import com.manus.jobhunter.ethiopia.data.local.*
import com.manus.jobhunter.ethiopia.data.remote.*
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class SourceRepository(private val api: JobHunterApi, private val dao: SourceDao) {
    fun observeSources(): Flow<List<SourceEntity>> = dao.observeAll()

    suspend fun refresh(): Result<Unit> = runCatching {
        val dtos = api.listSources()
        dao.upsertAll(dtos.map {
            SourceEntity(it.sourceId, it.sourceName, it.sourceType, it.baseUrl ?: "", it.enabled, it.ok, null, it.lastSyncStatus, it.jobCount)
        })
    }

    suspend fun setEnabled(id: String, enabled: Boolean): Result<Unit> = runCatching {
        api.setSourceEnabled(id, mapOf("enabled" to enabled))
        dao.setEnabled(id, enabled)
    }

    suspend fun triggerSync(sourceId: String? = null): Result<Unit> = runCatching {
        api.triggerSync(if (sourceId != null) mapOf("sourceId" to sourceId) else emptyMap())
        refresh()
    }
}

class ApplicationRepository(private val api: JobHunterApi, private val dao: ApplicationDao) {
    fun observeAll(): Flow<List<ApplicationEntity>> = dao.observeAll()

    suspend fun create(userId: String, jobId: String?, employer: String, title: String, status: String, notes: String?): Result<ApplicationEntity> =
        runCatching {
            val dto = api.createApplication(CreateApplicationRequest(userId, jobId, employer, title, status, notes))
            val entity = ApplicationEntity(dto.id, dto.jobId, dto.employer, dto.jobTitle, dto.status, null, null, null, null, dto.notes)
            dao.upsert(entity)
            entity
        }

    suspend fun update(id: String, status: String?, notes: String?): Result<Unit> = runCatching {
        val dto = api.patchApplication(id, PatchApplicationRequest(status, notes, null, null))
        dao.upsert(ApplicationEntity(dto.id, dto.jobId, dto.employer, dto.jobTitle, dto.status, null, dto.cvVersion, null, null, dto.notes))
    }

    suspend fun delete(id: String) = dao.deleteById(id)
}

class SavedJobRepository(private val api: JobHunterApi, private val dao: SavedJobDao) {
    fun observeAll(): Flow<List<SavedJobEntity>> = dao.observeAll()
    fun isSaved(jobId: String): Flow<Boolean> = dao.observeIsSaved(jobId)

    suspend fun save(userId: String, jobId: String, notes: String?): Result<Unit> = runCatching {
        api.saveJob(SavedJobRequest(userId, jobId, notes))
        dao.save(SavedJobEntity(jobId, notes))
    }

    suspend fun remove(userId: String, jobId: String): Result<Unit> = runCatching {
        api.deleteSaved(jobId, userId)
        dao.remove(jobId)
    }
}

class CvRepository(private val api: JobHunterApi, private val dao: CvDao) {
    fun observeAll(): Flow<List<CvEntity>> = dao.observeAll()
    suspend fun getDefault(): CvEntity? = dao.getDefault()

    suspend fun create(cv: CvCreateRequest): Result<String> = runCatching {
        val res = api.createCv(cv)
        val id = res["id"]?.toString() ?: UUID.randomUUID().toString()
        dao.upsert(CvEntity(id, cv.title, cv.fullName, cv.email, cv.phone, cv.location, null, Gson().toJson(cv), isDefault = true))
        id
    }
}

class AiRepository(private val api: JobHunterApi) {
    suspend fun match(cvId: String, jobId: String): Result<MatchResponseDto> = runCatching { api.match(MatchRequest(cvId, jobId)) }
    suspend fun coverLetter(cvId: String, jobId: String, notes: String?): Result<String> = runCatching { api.coverLetter(CoverLetterRequest(cvId, jobId, notes)).letter }
    suspend fun interviewPrep(cvId: String, jobId: String): Result<List<InterviewQuestionDto>> = runCatching { api.interviewPrep(MatchRequest(cvId, jobId)).questions }
    suspend fun scamCheck(jobId: String): Result<RiskAssessmentDto> = runCatching { api.scamCheck(jobId) }
    suspend fun chat(messages: List<ChatMessageDto>): Result<ChatResponseDto> = runCatching { api.chat(ChatRequestDto(messages)) }
}
