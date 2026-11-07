package com.manus.jobhunter.ethiopia.presentation.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.manus.jobhunter.ethiopia.AppContainer
import com.manus.jobhunter.ethiopia.data.local.*
import com.manus.jobhunter.ethiopia.data.remote.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class HomeViewModel(private val c: AppContainer) : ViewModel() {
    val jobs: StateFlow<List<JobEntity>> = c.jobs.observeRecent()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _refreshing.value = true
            c.jobs.refresh().onFailure { _message.value = "Working offline — showing cached data" }
            _refreshing.value = false
        }
    }
}

class DiscoverViewModel(private val c: AppContainer) : ViewModel() {
    val region = MutableStateFlow<String?>(null)
    val sector = MutableStateFlow<String?>(null)

    val jobs: StateFlow<List<JobEntity>> = combine(region, sector) { r, s -> r to s }
        .flatMapLatest { (r, s) -> c.jobs.searchLocal(null, r, s) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val regions: StateFlow<String> = c.prefs.regions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Addis Ababa")

    init {
        viewModelScope.launch { c.jobs.refresh() }
    }
}

class SearchViewModel(private val c: AppContainer) : ViewModel() {
    val query = MutableStateFlow("")
    val region = MutableStateFlow<String?>(null)
    val sector = MutableStateFlow<String?>(null)

    val results: StateFlow<List<JobEntity>> = combine(query, region, sector) { q, r, s ->
        Triple(q.ifBlank { null }, r, s)
    }.flatMapLatest { (q, r, s) -> c.jobs.searchLocal(q, r, s) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}

class JobDetailViewModel(private val c: AppContainer, val jobId: String) : ViewModel() {
    private val _job = MutableStateFlow<JobEntity?>(null)
    val job: StateFlow<JobEntity?> = _job
    val isSaved: StateFlow<Boolean> = c.saved.isSaved(jobId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    private val _risk = MutableStateFlow<RiskAssessmentDto?>(null)
    val risk: StateFlow<RiskAssessmentDto?> = _risk

    init {
        viewModelScope.launch {
            _job.value = c.jobs.getJob(jobId)
            c.ai.scamCheck(jobId).onSuccess { _risk.value = it }
        }
    }

    fun toggleSaved() {
        viewModelScope.launch {
            if (isSaved.value) c.saved.remove("local", jobId)
            else c.saved.save("local", jobId, null)
        }
    }
}

class MatchingViewModel(private val c: AppContainer) : ViewModel() {
    val cvs: StateFlow<List<CvEntity>> = c.cv.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val jobs: StateFlow<List<JobEntity>> = c.jobs.observeRecent()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val selectedCv = MutableStateFlow<CvEntity?>(null)
    val selectedJob = MutableStateFlow<JobEntity?>(null)
    private val _result = MutableStateFlow<MatchResponseDto?>(null)
    val result: StateFlow<MatchResponseDto?> = _result
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    fun compute() {
        val cv = selectedCv.value ?: return
        val job = selectedJob.value ?: return
        viewModelScope.launch {
            _loading.value = true
            c.ai.match(cv.id, job.id).onSuccess { _result.value = it }
            _loading.value = false
        }
    }
}

class CvViewModel(private val c: AppContainer) : ViewModel() {
    val cvs: StateFlow<List<CvEntity>> = c.cv.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val fullName = MutableStateFlow("")
    val email = MutableStateFlow("")
    val phone = MutableStateFlow("")
    val location = MutableStateFlow("Addis Ababa")
    val degree = MutableStateFlow("")
    val institution = MutableStateFlow("")
    val skills = MutableStateFlow("")
    val employer = MutableStateFlow("")
    val roleTitle = MutableStateFlow("")
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    fun save() {
        viewModelScope.launch {
            val req = CvCreateRequest(
                userId = "local",
                title = if (fullName.value.isNotBlank()) "${fullName.value}'s CV" else "My CV",
                fullName = fullName.value.ifBlank { null },
                email = email.value.ifBlank { null },
                phone = phone.value.ifBlank { null },
                location = location.value,
                education = if (degree.value.isNotBlank()) listOf(EduDto(institution.value.ifBlank { "University" }, degree.value, "BACHELOR", null)) else emptyList(),
                experience = if (employer.value.isNotBlank()) listOf(ExpDto(employer.value, roleTitle.value.ifBlank { "Role" })) else emptyList(),
                skills = skills.value.split(",").map { it.trim() }.filter { it.isNotBlank() }.map { SkillDto(it) }
            )
            c.cv.create(req).onSuccess { _message.value = "CV saved" }.onFailure { _message.value = it.message }
        }
    }
}

class SavedViewModel(private val c: AppContainer) : ViewModel() {
    val saved: StateFlow<List<SavedJobEntity>> = c.saved.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    fun remove(jobId: String) { viewModelScope.launch { c.saved.remove("local", jobId) } }
}

class ApplicationsViewModel(private val c: AppContainer) : ViewModel() {
    val applications: StateFlow<List<ApplicationEntity>> = c.applications.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateStatus(id: String, status: String, notes: String? = null) {
        viewModelScope.launch { c.applications.update(id, status, notes) }
    }
    fun delete(id: String) { viewModelScope.launch { c.applications.delete(id) } }
    fun create(employer: String, title: String, status: String) {
        viewModelScope.launch { c.applications.create("local", null, employer, title, status, null) }
    }
}

class SourcesViewModel(private val c: AppContainer) : ViewModel() {
    val sources: StateFlow<List<SourceEntity>> = c.sources.observeSources()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    init { viewModelScope.launch { c.sources.refresh() } }

    fun toggle(id: String, enabled: Boolean) { viewModelScope.launch { c.sources.setEnabled(id, enabled) } }
    fun sync(id: String? = null) {
        viewModelScope.launch {
            _message.value = "Syncing…"
            c.sources.triggerSync(id).onSuccess { _message.value = "Sync complete" }
        }
    }
}

class AssistantViewModel(private val c: AppContainer) : ViewModel() {
    val messages = MutableStateFlow(listOf(ChatMessageDto("assistant", "Hello! I'm your JobHunter career assistant. Ask me about Ethiopian job requirements, CV tips, cover letters, or interview preparation.")))
    val input = MutableStateFlow("")
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading
    val coverLetterOut = MutableStateFlow<String?>(null)
    val questionsOut = MutableStateFlow<List<InterviewQuestionDto>>(emptyList())

    fun send() {
        val q = input.value.trim(); if (q.isBlank()) return
        val updated = messages.value + ChatMessageDto("user", q)
        messages.value = updated
        input.value = ""
        viewModelScope.launch {
            _loading.value = true
            c.ai.chat(updated).onSuccess {
                messages.value = updated + ChatMessageDto("assistant", it.reply)
            }.onFailure {
                messages.value = updated + ChatMessageDto("assistant", "The AI assistant is temporarily unavailable. All job search and tracking features remain fully functional.")
            }
            _loading.value = false
        }
    }
}

class SettingsViewModel(private val c: AppContainer) : ViewModel() {
    val language: StateFlow<String> = c.prefs.language.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "en")
    val regions: StateFlow<String> = c.prefs.regions.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Addis Ababa")
    val consent: StateFlow<Boolean> = c.prefs.consentAi.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    val provider: StateFlow<String> = c.prefs.aiProvider.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "groq")

    fun setLanguage(v: String) = viewModelScope.launch { c.prefs.setLanguage(v) }
    fun setRegions(v: String) = viewModelScope.launch { c.prefs.setRegions(v) }
    fun setConsent(v: Boolean) = viewModelScope.launch { c.prefs.setConsentAi(v) }
    fun setProvider(v: String) = viewModelScope.launch { c.prefs.setAiProvider(v) }
}
