package com.manus.jobhunter.ethiopia.presentation.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.manus.jobhunter.ethiopia.data.local.JobEntity
import com.manus.jobhunter.ethiopia.presentation.theme.*
import java.text.SimpleDateFormat
import java.util.*

val ETHIOPIAN_REGIONS_UI = listOf("Addis Ababa", "Oromia", "Amhara", "Sidama", "Tigray", "Somali", "Afar", "Benishangul-Gumuz", "Gambela", "Central Ethiopia", "South Ethiopia", "Southwest Ethiopia", "Harari", "Dire Dawa")
val SECTORS_UI = listOf("ICT & Software", "NGO & Humanitarian", "Health & Medical", "Finance & Banking", "Education & Teaching", "Engineering & Construction", "Sales & Marketing", "Agriculture & Environment", "Transport & Logistics", "Government & Public Sector", "Hotel & Hospitality", "Customer Service", "Internships & Entry-Level", "Legal & Law", "Manufacturing & Trades")
val APPLICATION_STATUSES = listOf("INTERESTED", "SAVED", "PREPARING", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN", "EXPIRED")

@Composable
fun HomeScreen(vm: HomeViewModel, onOpenJob: (String) -> Unit, onSearch: () -> Unit, onSources: () -> Unit, onAssistant: () -> Unit) {
    val jobs by vm.jobs.collectAsState()
    val msg by vm.message.collectAsState()
    Scaffold(topBar = { CenterAlignedTopAppBar(title = { Text("JobHunter Ethiopia") }, actions = {
        IconButton(onClick = onSearch) { Icon(Icons.Default.Search, contentDescription = "Search") }
        IconButton(onClick = onSources) { Icon(Icons.Default.Dns, contentDescription = "Sources") }
        IconButton(onClick = onAssistant) { Icon(Icons.Default.SmartToy, contentDescription = "AI Assistant") }
    }) }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            msg?.let { OfflineBanner(it) }
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${jobs.size} opportunities", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                TextButton(onClick = { vm.refresh() }) { Text("Refresh") }
            }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(jobs, key = { it.id }) { JobCard(it, onClick = { onOpenJob(it.id) }) }
            }
        }
    }
}

@Composable
fun DiscoverScreen(vm: DiscoverViewModel, onOpenJob: (String) -> Unit) {
    val jobs by vm.jobs.collectAsState()
    val region by vm.region.collectAsState()
    val sector by vm.sector.collectAsState()
    Scaffold(topBar = { TopAppBar(title = { Text("Discover") }) }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            ScrollChips("All regions", ETHIOPIAN_REGIONS_UI, region) { vm.region.value = it }
            ScrollChips("All sectors", SECTORS_UI, sector) { vm.sector.value = it }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(jobs, key = { it.id }) { JobCard(it, onClick = { onOpenJob(it.id) }) }
            }
        }
    }
}

@Composable
fun SearchScreen(vm: SearchViewModel, onOpenJob: (String) -> Unit) {
    val q by vm.query.collectAsState()
    val results by vm.results.collectAsState()
    val region by vm.region.collectAsState()
    val sector by vm.sector.collectAsState()
    Scaffold(topBar = { TopAppBar(title = { Text("Search & Filters") }) }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            OutlinedTextField(q, { vm.query.value = it }, Modifier.fillMaxWidth().padding(16.dp), placeholder = { Text("Title, skill, employer…") }, leadingIcon = { Icon(Icons.Default.Search, null) })
            ScrollChips("Any region", ETHIOPIAN_REGIONS_UI, region) { vm.region.value = it }
            ScrollChips("Any sector", SECTORS_UI, sector) { vm.sector.value = it }
            Text("${results.size} results", Modifier.padding(horizontal = 16.dp, vertical = 4.dp), style = MaterialTheme.typography.bodySmall)
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(results, key = { it.id }) { JobCard(it, onClick = { onOpenJob(it.id) }) }
            }
        }
    }
}

@Composable
fun JobDetailScreen(vm: JobDetailViewModel) {
    val job by vm.job.collectAsState()
    val saved by vm.isSaved.collectAsState()
    val risk by vm.risk.collectAsState()
    val ctx = LocalContext.current
    val j = job ?: run { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }; return }
    Scaffold(topBar = {
        TopAppBar(title = { Text("Job Details") }, actions = {
            IconButton(onClick = { vm.toggleSaved() }) { Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = "Save") }
        })
    }) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(j.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("${j.employer} • ${j.sourceAttribution}", style = MaterialTheme.typography.bodyMedium, color = ForestGreen)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = {}, label = { Text(j.region) })
                AssistChip(onClick = {}, label = { Text(j.sector) })
                AssistChip(onClick = {}, label = { Text(j.employmentType) })
            }
            j.deadline?.let { Text("Deadline: ${SimpleDateFormat("MMM d, yyyy", Locale.US).format(Date(it))}", color = Terracotta, fontWeight = FontWeight.SemiBold) }
            j.salaryRaw?.let { Text("Salary: $it") }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Verified", color = Color(0xFF2E7D32))
                Text("• ${SimpleDateFormat("MMM d", Locale.US).format(Date(j.lastVerifiedAt))}", style = MaterialTheme.typography.bodySmall)
            }
            risk?.flags?.takeIf { it.isNotEmpty() }?.let { flags ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Listing flags (${flags.size})", fontWeight = FontWeight.Bold, color = Color(0xFFE65100))
                        flags.forEach { f -> Text("• ${f.reason}", style = MaterialTheme.typography.bodySmall) }
                    }
                }
            }
            Text("Description", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(j.descriptionPlain ?: j.description)
            j.applicationInstructions?.let { Text("How to apply: $it", style = MaterialTheme.typography.bodySmall) }
            Button(onClick = { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(j.applicationUrl ?: j.originalUrl))) }, Modifier.fillMaxWidth()) {
                Text("Apply on original site")
            }
            OutlinedButton(onClick = { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(j.originalUrl))) }, Modifier.fillMaxWidth()) {
                Text("View original posting")
            }
        }
    }
}

@Composable
fun AiMatchingScreen(vm: MatchingViewModel) {
    val cvs by vm.cvs.collectAsState()
    val jobs by vm.jobs.collectAsState()
    val selCv by vm.selectedCv.collectAsState()
    val selJob by vm.selectedJob.collectAsState()
    val res by vm.result.collectAsState()
    val loading by vm.loading.collectAsState()
    Scaffold(topBar = { TopAppBar(title = { Text("AI Job Matching") }) }) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Select CV & Job to see a transparent fit breakdown", style = MaterialTheme.typography.bodySmall)
            DropdownSection("CV", cvs.map { it.title }, cvs.indexOf(selCv)) { i -> vm.selectedCv.value = cvs.getOrNull(i) }
            DropdownSection("Job", jobs.map { "${it.title} — ${it.employer}" }, jobs.indexOf(selJob)) { i -> vm.selectedJob.value = jobs.getOrNull(i) }
            Button(onClick = { vm.compute() }, enabled = selCv != null && selJob != null && !loading, modifier = Modifier.fillMaxWidth()) {
                if (loading) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White) else Text("Compute match score")
            }
            res?.let { m ->
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Overall fit: ${m.overallScore}%", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(m.disclaimer, style = MaterialTheme.typography.bodySmall)
                        m.dimensions.forEach { d ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(d.name); Text("${d.score}/${d.maxScore}")
                            }
                            LinearProgressIndicator(progress = d.score / d.maxScore.toFloat(), modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
                m.strongMatches.takeIf { it.isNotEmpty() }?.let { SectionBlock("Strong matches", it) }
                m.missingRequirements.takeIf { it.isNotEmpty() }?.let { SectionBlock("Missing requirements", it, Terracotta) }
                m.unknownRequirements.takeIf { it.isNotEmpty() }?.let { SectionBlock("Not specified by employer", it, Color.Gray) }
                m.disqualifiers.takeIf { it.isNotEmpty() }?.let { SectionBlock("Potential disqualifiers", it, Terracotta) }
                m.aiExplanation?.let { Card { Column(Modifier.padding(12.dp)) { Text("AI explanation", fontWeight = FontWeight.Bold); Text(it, style = MaterialTheme.typography.bodySmall) } } }
            }
        }
    }
}

@Composable
fun CvManagerScreen(vm: CvViewModel) {
    val cvs by vm.cvs.collectAsState()
    val msg by vm.message.collectAsState()
    Scaffold(topBar = { TopAppBar(title = { Text("CV Manager") }) }) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Create or edit your profile — used for match scoring and cover letters", style = MaterialTheme.typography.bodySmall)
            BindingField("Full name", vm.fullName)
            BindingField("Email", vm.email)
            BindingField("Phone", vm.phone)
            BindingField("Location (region/city)", vm.location)
            BindingField("Degree / qualification", vm.degree)
            BindingField("Institution", vm.institution)
            BindingField("Latest employer", vm.employer)
            BindingField("Role title", vm.roleTitle)
            BindingField("Skills (comma-separated)", vm.skills)
            Button(onClick = { vm.save() }, Modifier.fillMaxWidth()) { Text("Save profile") }
            msg?.let { Text(it, color = ForestGreen, fontWeight = FontWeight.SemiBold) }
            Text("Saved profiles (${cvs.size})", style = MaterialTheme.typography.titleMedium)
            cvs.forEach { c -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { Text(c.title, fontWeight = FontWeight.Bold); Text("${c.fullName ?: ""} • ${c.location ?: ""}", style = MaterialTheme.typography.bodySmall) } } }
        }
    }
}

@Composable
fun SavedScreen(vm: SavedViewModel, onOpenJob: (String) -> Unit) {
    val saved by vm.saved.collectAsState()
    Scaffold(topBar = { TopAppBar(title = { Text("Saved Jobs") }) }) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(saved, key = { it.jobId }) { s ->
                Card(Modifier.fillMaxWidth().clickable { onOpenJob(s.jobId) }) {
                    Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) { Text(s.jobId, fontWeight = FontWeight.Bold, maxLines = 1); s.notes?.let { Text(it, style = MaterialTheme.typography.bodySmall) } }
                        IconButton(onClick = { vm.remove(s.jobId) }) { Icon(Icons.Default.BookmarkRemove, contentDescription = "Remove") }
                    }
                }
            }
        }
    }
}

@Composable
fun ApplicationsScreen(vm: ApplicationsViewModel) {
    val apps by vm.applications.collectAsState()
    var emp by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("INTERESTED") }
    Scaffold(topBar = { TopAppBar(title = { Text("Applications") }) }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            Card(Modifier.fillMaxWidth().padding(16.dp)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Track an application", fontWeight = FontWeight.Bold)
                    OutlinedTextField(emp, { emp = it }, Modifier.fillMaxWidth(), placeholder = { Text("Employer") })
                    OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), placeholder = { Text("Job title") })
                    ScrollChips(null, APPLICATION_STATUSES, status) { it?.let { s -> status = s } }
                    Button(onClick = { vm.create(emp, title, status); emp = ""; title = "" }, Modifier.fillMaxWidth(), enabled = emp.isNotBlank()) { Text("Add") }
                }
            }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(apps, key = { it.id }) { a ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(a.jobTitle, fontWeight = FontWeight.Bold); AssistChip(onClick = {}, label = { Text(a.status) })
                            }
                            Text(a.employer, style = MaterialTheme.typography.bodySmall)
                            a.notes?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                            ScrollChips("Move status", APPLICATION_STATUSES, a.status) { it?.let { s -> vm.updateStatus(a.id, s) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationsScreen() {
    Scaffold(topBar = { TopAppBar(title = { Text("Notifications") }) }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Alert preferences", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            ToggleRow("New matching jobs", true)
            ToggleRow("Application deadlines", true)
            ToggleRow("Interview reminders", true)
            Text("No fake immediate alerts — notifications follow periodic sync intervals (every 6 hours).", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
        }
    }
}

@Composable
fun AssistantScreen(vm: AssistantViewModel) {
    val msgs by vm.messages.collectAsState()
    val input by vm.input.collectAsState()
    val loading by vm.loading.collectAsState()
    Scaffold(topBar = { TopAppBar(title = { Text("AI Career Assistant") }) }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(msgs) { m ->
                    val mine = m.role == "user"
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
                        Surface(shape = MaterialTheme.shapes.medium, color = if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.widthIn(max = 300.dp)) {
                            Text(m.content, Modifier.padding(12.dp), color = if (mine) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                if (loading) item { CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally)) }
            }
            Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(input, { vm.input.value = it }, Modifier.weight(1f), placeholder = { Text("Ask about requirements, CVs, cover letters…") })
                IconButton(onClick = { vm.send() }) { Icon(Icons.Default.Send, contentDescription = "Send") }
            }
        }
    }
}

@Composable
fun SourcesScreen(vm: SourcesViewModel) {
    val sources by vm.sources.collectAsState()
    val msg by vm.message.collectAsState()
    Scaffold(topBar = {
        TopAppBar(title = { Text("Job Sources") }, actions = { TextButton(onClick = { vm.sync() }) { Text("Sync all") } })
    }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            msg?.let { Text(it, Modifier.padding(16.dp), color = ForestGreen, fontWeight = FontWeight.SemiBold) }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(sources, key = { it.id }) { s ->
                    Card(Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f)) {
                                Text(s.name, fontWeight = FontWeight.Bold)
                                Text("${s.type} • ${s.jobCount} jobs • ${s.lastSyncStatus ?: "pending"}", style = MaterialTheme.typography.bodySmall)
                            }
                            Switch(checked = s.enabled, onCheckedChange = { vm.toggle(s.id, it) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(vm: SettingsViewModel, onSources: () -> Unit) {
    val lang by vm.language.collectAsState()
    val regions by vm.regions.collectAsState()
    val consent by vm.consent.collectAsState()
    val provider by vm.provider.collectAsState()
    Scaffold(topBar = { TopAppBar(title = { Text("Settings & Profile") }) }) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Language", fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = lang == "en", onClick = { vm.setLanguage("en") }, label = { Text("English") })
                FilterChip(selected = lang == "am", onClick = { vm.setLanguage("am") }, label = { Text("አማርኛ") })
            }
            Text("Preferred regions (comma-separated)", fontWeight = FontWeight.Bold)
            OutlinedTextField(regions, { vm.setRegions(it) }, Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("AI processing consent", fontWeight = FontWeight.Bold)
                    Text("Your CV is sent to your chosen provider only with consent; keys never live in this app.", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                }
                Switch(consent, { vm.setConsent(it) })
            }
            Text("Preferred AI provider", fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("groq", "nvidia", "mistral").forEach { p ->
                    FilterChip(selected = provider == p, onClick = { vm.setProvider(p) }, label = { Text(p) })
                }
            }
            OutlinedButton(onClick = onSources, Modifier.fillMaxWidth()) { Text("Manage job sources") }
            Text("JobHunter Ethiopia • offline-first • no fake jobs ever", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
        }
    }
}

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    var lang by remember { mutableStateOf("en") }
    Scaffold { pad ->
        Column(Modifier.padding(pad).fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("JobHunter Ethiopia", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = ForestGreen)
                Text("All Ethiopian jobs in one place — honest match scores, offline access, real sources only.", style = MaterialTheme.typography.bodyMedium)
                Text("Choose language", fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = lang == "en", onClick = { lang = "en" }, label = { Text("English") })
                    FilterChip(selected = lang == "am", onClick = { lang = "am" }, label = { Text("አማርኛ") })
                }
                Text("Privacy promise: AI provider keys are never stored in this app. CV processing happens server-side with your consent.", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
            }
            Button(onClick = onDone, Modifier.fillMaxWidth()) { Text("Get started") }
        }
    }
}

// ── Reusable components ──────────────────────────────────────────
@Composable
fun JobCard(j: JobEntity, onClick: () -> Unit) {
    val fmt = SimpleDateFormat("MMM d", Locale.US)
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(j.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                BadgeChip("Cached")
            }
            Text("${j.employer} • ${j.sourceAttribution}", style = MaterialTheme.typography.bodySmall, color = ForestGreen)
            Text(j.locationRaw, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(j.sector, style = MaterialTheme.typography.bodySmall)
                Text(j.deadline?.let { "Due ${fmt.format(Date(it))}" } ?: "Open", style = MaterialTheme.typography.bodySmall, color = Terracotta)
            }
        }
    }
}

@Composable
fun BadgeChip(text: String) {
    Surface(shape = MaterialTheme.shapes.small, color = Color(0xFFE8F5E9)) {
        Text(text, Modifier.padding(horizontal = 8.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = Color(0xFF2E7D32))
    }
}

@Composable
fun OfflineBanner(text: String) {
    Row(Modifier.fillMaxWidth().background(Color(0xFFFFF9C4)).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Default.CloudOff, contentDescription = null, tint = Color(0xFFF57F17)); Spacer(Modifier.width(8.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = Color(0xFF7F6000))
    }
}

@Composable
fun ScrollChips(allLabel: String?, options: List<String>, selected: String?, onSelect: (String?) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        allLabel?.let { item { FilterChip(selected = selected == null, onClick = { onSelect(null) }, label = { Text(it) }) } }
        items(options) { o -> FilterChip(selected = selected == o, onClick = { onSelect(if (selected == o) null else o) }, label = { Text(o) }) }
    }
}

@Composable
fun SectionBlock(title: String, items: List<String>, color: Color = Color.Unspecified) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontWeight = FontWeight.Bold, color = color)
            items.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
        }
    }
}

@Composable
fun DropdownSection(label: String, items: List<String>, selectedIndex: Int, onSelect: (Int) -> Unit) {
    var exp by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth()) {
        OutlinedCard(onClick = { exp = true }, modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(items.getOrElse(selectedIndex) { "Select $label" }, maxLines = 1)
                Icon(Icons.Default.ArrowDropDown, null)
            }
        }
        DropdownMenu(exp, { exp = false }) {
            items.forEachIndexed { i, it -> DropdownMenuItem(text = { Text(it, maxLines = 1) }, onClick = { onSelect(i); exp = false }) }
        }
    }
}

@Composable
fun BindingField(label: String, flow: kotlinx.coroutines.flow.MutableStateFlow<String>) {
    val v by flow.collectAsState()
    OutlinedTextField(v, { flow.value = it }, Modifier.fillMaxWidth(), label = { Text(label) })
}

@Composable
fun ToggleRow(label: String, initial: Boolean) {
    var v by remember { mutableStateOf(initial) }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label); Switch(v, { v = it })
    }
}
