package com.manus.jobhunter.ethiopia.data.remote

import com.google.gson.annotations.SerializedName

data class HealthDto(
    val status: String,
    val database: String,
    val version: String,
    val aiProvidersConfigured: List<String>?,
    val sourcesHealthy: Int,
    val sourcesTotal: Int
)

data class JobSearchResultDto(
    val jobs: List<JobDto>,
    val total: Int,
    val hasMore: Boolean,
    val nextCursor: String?
)

data class JobDto(
    val id: String,
    val title: String,
    val employer: String,
    val employerWebsite: String?,
    val description: String?,
    val descriptionPlain: String?,
    val sector: String?,
    val region: String?,
    val city: String?,
    val locationRaw: String?,
    val employmentType: String?,
    val experienceLevel: String?,
    val educationLevel: String?,
    val salaryMin: Double?,
    val salaryMax: Double?,
    val currency: String?,
    val salaryRaw: String?,
    val publishedAt: String?,
    val deadline: String?,
    val lastVerifiedAt: String?,
    val originalUrl: String,
    val applicationUrl: String?,
    val applicationMethod: String?,
    val applicationInstructions: String?,
    val sourceAttribution: String?,
    val verificationStatus: String?,
    val expirationStatus: String?,
    val riskFlags: List<RiskFlagDto>?
)

data class RiskFlagDto(
    val code: String,
    val severity: String,
    val reason: String,
    val evidence: String?
)

data class SourceDto(
    val sourceId: String,
    val sourceName: String,
    val sourceType: String,
    val baseUrl: String?,
    val enabled: Boolean,
    val ok: Boolean,
    val lastSyncAt: String?,
    val lastSyncStatus: String?,
    val jobCount: Int
)

data class CvCreateRequest(
    val userId: String,
    val title: String,
    val fullName: String?,
    val email: String?,
    val phone: String?,
    val location: String?,
    val education: List<EduDto>?,
    val experience: List<ExpDto>?,
    val skills: List<SkillDto>?
)

data class EduDto(val institution: String, val degree: String, val level: String?, val cgpa: Double?)
data class ExpDto(val employer: String, val title: String, val isInternship: Boolean = false)
data class SkillDto(val name: String)

data class MatchRequest(val cvId: String, val jobId: String)

data class MatchResponseDto(
    val overallScore: Int,
    val dimensions: List<MatchDimensionDto>,
    val strongMatches: List<String>,
    val missingRequirements: List<String>,
    val partialRequirements: List<String>,
    val unknownRequirements: List<String>,
    val disqualifiers: List<String>,
    val aiExplanation: String?,
    val providerUsed: String?,
    val disclaimer: String
)

data class MatchDimensionDto(val name: String, val score: Int, val maxScore: Int, val notes: String)

data class CoverLetterRequest(val cvId: String, val jobId: String, val notes: String?)
data class CoverLetterResponse(val letter: String)

data class InterviewPrepResponse(val questions: List<InterviewQuestionDto>)
data class InterviewQuestionDto(val question: String, val hint: String?, val topic: String?)

data class RiskAssessmentDto(
    val riskLevel: String,
    val flags: List<RiskFlagDto>
)

data class ChatRequestDto(val messages: List<ChatMessageDto>)
data class ChatMessageDto(val role: String, val content: String)
data class ChatResponseDto(val reply: String, val providerUsed: String?)

data class ApplicationRecordDto(
    val id: String,
    val jobId: String?,
    val employer: String,
    val jobTitle: String,
    val status: String,
    val appliedAt: String?,
    val cvVersion: String?,
    val followUpDate: String?,
    val interviewDate: String?,
    val notes: String?
)

data class CreateApplicationRequest(
    val userId: String,
    val jobId: String?,
    val employer: String,
    val jobTitle: String,
    val status: String,
    val notes: String?
)

data class PatchApplicationRequest(
    val status: String?,
    val notes: String?,
    val followUpDate: String?,
    val interviewDate: String?
)

data class SavedJobRequest(val userId: String, val jobId: String, val notes: String?)
data class SavedJobDto(val id: String, val jobId: String, val job: JobDto?, val notes: String?)
data class RegionsMetaDto(val regions: List<String>, val majorCities: List<CityDto>?)
data class CityDto(val name: String, val region: String)
