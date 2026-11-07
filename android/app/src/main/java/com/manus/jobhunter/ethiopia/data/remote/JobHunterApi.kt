package com.manus.jobhunter.ethiopia.data.remote

import retrofit2.http.*

interface JobHunterApi {

    @GET("health")
    suspend fun health(): HealthDto

    @GET("sources")
    suspend fun listSources(): List<SourceDto>

    @POST("sources/sync")
    suspend fun triggerSync(@Body body: Map<String, String> = emptyMap()): Any

    @PATCH("sources/{id}")
    suspend fun setSourceEnabled(@Path("id") id: String, @Body body: Map<String, Boolean>): Map<String, Any>

    @GET("jobs")
    suspend fun searchJobs(
        @Query("q") q: String? = null,
        @Query("regions") regions: String? = null,
        @Query("cities") cities: String? = null,
        @Query("sectors") sectors: String? = null,
        @Query("employmentType") employmentType: String? = null,
        @Query("educationLevel") educationLevel: String? = null,
        @Query("salaryMin") salaryMin: Double? = null,
        @Query("sort") sort: String? = null,
        @Query("limit") limit: Int? = 30,
        @Query("cursor") cursor: String? = null
    ): JobSearchResultDto

    @GET("jobs/{id}")
    suspend fun jobDetail(@Path("id") id: String): JobDto

    @POST("cv")
    suspend fun createCv(@Body body: CvCreateRequest): Map<String, Any>

    @POST("match")
    suspend fun match(@Body body: MatchRequest): MatchResponseDto

    @POST("cover-letter")
    suspend fun coverLetter(@Body body: CoverLetterRequest): CoverLetterResponse

    @POST("interview-prep")
    suspend fun interviewPrep(@Body body: MatchRequest): InterviewPrepResponse

    @POST("scam-check/{id}")
    suspend fun scamCheck(@Path("id") id: String): RiskAssessmentDto

    @POST("assistant/chat")
    suspend fun chat(@Body body: ChatRequestDto): ChatResponseDto

    @GET("applications")
    suspend fun listApplications(@Query("userId") userId: String): List<ApplicationRecordDto>

    @POST("applications")
    suspend fun createApplication(@Body body: CreateApplicationRequest): ApplicationRecordDto

    @PATCH("applications/{id}")
    suspend fun patchApplication(@Path("id") id: String, @Body body: PatchApplicationRequest): ApplicationRecordDto

    @GET("saved")
    suspend fun listSaved(@Query("userId") userId: String): List<SavedJobDto>

    @POST("saved")
    suspend fun saveJob(@Body body: SavedJobRequest): SavedJobDto

    @DELETE("saved/{jobId}")
    suspend fun deleteSaved(@Path("jobId") jobId: String, @Query("userId") userId: String): Map<String, Any>

    @GET("meta/regions")
    suspend fun regionsMeta(): RegionsMetaDto
}
