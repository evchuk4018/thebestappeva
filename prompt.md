# Codex → OpenCode Sequential Implementation Orchestrator

You are the orchestration controller for the repository:

* Repository: `evchuk4018/thebestappeva`
* Branch: `main`
* Application type: full-stack web application
* Primary coding agent: OpenCode
* OpenCode model: GLM 5.2
* Execution model: strictly sequential
* Pull requests: none
* Final destination: commits pushed directly to `main`

Your job is **not to implement the tickets yourself**. Your job is to direct OpenCode through every ticket, answer its questions, validate its work, and move to the next ticket only after the current ticket passes validation.

## Non-negotiable operating rules

1. Work on exactly one ticket at a time.
2. Never run multiple OpenCode agents concurrently.
3. Start a fresh OpenCode session for every new ticket.
4. Start OpenCode in plan mode.
5. Give OpenCode the complete ticket, global constraints, and relevant context.
6. Let OpenCode inspect the repository before deciding architecture.
7. Answer OpenCode’s questions yourself using:

   * The repository
   * Existing application behavior
   * This specification
   * The most reasonable product decision
8. Do not ask the user questions.
9. Once OpenCode’s plan is sound, instruct it to implement the ticket.
10. All code modifications must be performed by OpenCode.
11. Codex may inspect files, inspect diffs, run commands, run tests, and provide feedback, but must not directly implement fixes.
12. OpenCode must commit each completed ticket.
13. Do not begin the next ticket until the current ticket:

* Is implemented
* Has been reviewed
* Has passed relevant tests
* Has not introduced regressions
* Has been committed

14. If validation fails, return the exact failures to the same OpenCode session and require it to fix them.
15. Continue the fix-and-test loop until the ticket passes.
16. Do not skip tickets because they are difficult.
17. Do not silently reduce scope.
18. Do not create pull requests.
19. After every ticket is complete, run the complete validation suite and push all commits to `main`.

## Model requirement

Use GLM 5.2 for OpenCode.

Before beginning, confirm the exact installed provider/model identifier for GLM 5.2. Do not silently substitute GLM 5.1 or another model. If the configured identifier differs from the display name, use the exact configured identifier that resolves to GLM 5.2.

## Repository-first rule

The existing repository is the source of truth for:

* Frameworks
* Component conventions
* Database architecture
* Existing artifact behavior
* Existing document parsing
* Existing tool execution
* Existing search behavior
* Existing error handling
* Existing UI styling
* Existing tests
* Existing API providers
* Existing state-management patterns

Before planning every ticket, OpenCode must inspect the relevant implementation.

Do not invent a second system when an existing system can be extended.

When this specification says to copy existing behavior, OpenCode must locate that behavior in the repository and reuse its components, data flow, and visual conventions.

If a ticket is already fully implemented, verify it against the acceptance criteria instead of manufacturing unnecessary changes.

## Architecture constraints

* Preserve the existing architecture where reasonable.
* Keep files modular.
* Prefer strong long-term architecture over the fastest patch.
* Reuse the existing design system and components.
* Desktop web is the current target.
* Mobile optimization is not required for this project.
* Do not introduce breaking database migrations.
* Database changes must be additive and backward compatible.
* New mature dependencies are allowed when they improve reliability.
* Docker or another isolated runtime may be introduced for secure code execution.
* Preserve every model provider currently supported by the application.
* Do not add a separate offline/local-model architecture.
* Do not remove or break the existing DeepSeek API integration.
* Preserve existing user data.
* Do not delete or rewrite unrelated code.
* Do not discard pre-existing working-tree changes.

## Baseline validation

Before Ticket 1:

1. Inspect the repository structure.
2. Identify:

   * Development command
   * Production build command
   * Test command
   * Lint command
   * Type-check command
   * Database migration process
3. Run the existing validation suite.
4. Record any pre-existing failures.
5. For every ticket, require:

   * Relevant new tests to pass
   * No new failures compared with baseline
   * Production build to pass when affected
   * Type checking and linting to pass when affected

A ticket may not be marked failed solely because of a clearly documented unrelated pre-existing failure, but it must not introduce additional failures.

## Per-ticket orchestration loop

For each ticket, follow this exact sequence:

1. Confirm the working tree and current commit.
2. Read the ticket.
3. Inspect the relevant repository files.
4. Launch a fresh OpenCode session using GLM 5.2 in plan mode.
5. Send OpenCode:

   * The current ticket
   * The global architecture constraints
   * Relevant repository findings
   * The instruction to inspect the repository itself
6. Answer all OpenCode questions using the repository and this specification.
7. Review the proposed plan.
8. Correct the plan if it:

   * Duplicates existing infrastructure
   * Breaks current behavior
   * Ignores tests
   * Uses weak architecture
   * Exceeds or reduces the ticket scope
9. Tell OpenCode to implement the plan.
10. Wait until OpenCode finishes.
11. Confirm OpenCode committed the work.
12. Inspect:

* Commit
* Diff
* Changed files
* Database changes
* New dependencies
* Tests

13. Run all ticket-relevant validation.
14. If anything fails, send the exact output back to the same OpenCode session.
15. Repeat until everything passes.
16. Mark the ticket complete.
17. Start the next ticket with a fresh OpenCode session.

Do not ask for approval between tickets.

---

# Ticket Queue

Complete these tickets in this order.

## Phase 1 — Existing chat defects

### Ticket 1 — Fix chat history viewport cutoff

#### Goal

Fix the layout defect where the chat history is cut off and does not extend or scroll fully to the bottom of the visible screen.

#### Requirements

* Inspect the complete chat layout hierarchy.
* Identify the actual height, overflow, flexbox, grid, viewport, or container issue.
* Do not use arbitrary fixed heights as a patch unless the existing design requires them.
* The final message must remain fully reachable.
* The composer must not cover the final message.
* Streaming responses must continue scrolling correctly.
* Manual upward scrolling must not constantly force the user back to the bottom.
* Preserve the existing visual design.

#### Acceptance criteria

* The last message can always be fully viewed.
* The chat can scroll to the true bottom.
* The composer does not obscure content.
* Streaming behavior remains correct.
* No new horizontal scrolling or viewport overflow is introduced.

---

### Ticket 2 — Make chat search functional

#### Goal

Make the existing chat-search button actually search chats.

#### Requirements

* Inspect the current button, state, database queries, routing, and chat list.
* Reuse existing search UI and components.
* Search at minimum:

  * Chat titles
  * Message content
* Results must link to the matching chat.
* Selecting a result must open the correct chat.
* Search should not require loading every chat and every message into the browser when a backend query is appropriate.
* Include loading, empty, and error states.
* Do not create a second unrelated search interface.

#### Acceptance criteria

* Clicking the current search button opens working search behavior.
* Queries return relevant chats.
* Selecting a result opens the correct conversation.
* Empty searches and zero-result searches are handled cleanly.
* Existing chat navigation continues working.

---

### Ticket 3 — Replace the DeepSeek BYOK status label

#### Goal

Replace the visible `DeepSeek BYOK` label with a randomized work-status message.

#### Example messages

* Ready to work
* Working hard
* Hardly working
* Let’s build something
* Standing by
* Ready when you are
* Thinking cap on
* Locked in
* Here to help

#### Requirements

* Inspect where the current label is generated.
* Preserve any actual provider status information elsewhere if it is functionally important.
* Choose a message at a stable lifecycle point so it does not rapidly flicker during rendering.
* Keep the message appropriate for the current visual space.
* Make the message list easy to extend.
* Do not couple the visible status phrase to a specific model provider.

#### Acceptance criteria

* `DeepSeek BYOK` is no longer displayed in that location.
* A randomized approved message appears instead.
* The message does not change continuously during ordinary renders.
* Provider selection and API functionality remain unaffected.

---

# Phase 2 — Code presentation

## Ticket 4 — Establish structured code-block metadata

#### Goal

Represent model-generated code blocks as structured code-output objects instead of undifferentiated Markdown.

#### Requirements

Support metadata for:

* Code content
* Language
* Optional filename
* Whether content is a normal file or diff
* Execution eligibility
* Patch eligibility
* Associated output
* Associated errors
* Associated test results

Use existing message rendering and streaming architecture.

#### Acceptance criteria

* Fenced code blocks continue rendering during and after streaming.
* Language metadata is preserved.
* Optional filenames can be supplied and displayed.
* Existing Markdown rendering is not broken.
* Unknown languages degrade gracefully.

---

### Ticket 5 — Add syntax highlighting and code headers

#### Goal

Improve code-block rendering.

#### Required features

* Syntax highlighting
* Language label
* Optional filename
* Copy button
* Line numbers

#### Requirements

* Use a mature syntax-highlighting implementation.
* Avoid blocking message rendering for large code blocks.
* Preserve code exactly when copied.
* Do not include line-number text in copied code.
* Display filenames only when supplied or reliably inferred.
* Match the existing application design.

#### Acceptance criteria

* Supported languages are highlighted.
* Language labels are visible.
* Filenames display correctly.
* Copy copies the exact source.
* Line numbers align correctly with wrapped or non-wrapped code according to the chosen implementation.

---

### Ticket 6 — Add code download support

#### Goal

Allow a code block to be downloaded as a file.

#### Requirements

* Use the supplied filename when available.
* Otherwise generate a reasonable filename from the language.
* Use an appropriate extension and MIME type.
* Preserve the exact code contents.
* Do not send code to an external service merely to download it.

#### Acceptance criteria

* Download produces a valid file.
* Filename and extension are appropriate.
* File contents match the code block exactly.

---

### Ticket 7 — Add diff rendering

#### Goal

Render diff output in a dedicated diff view.

#### Requirements

* Detect explicitly marked diff or patch blocks.
* Clearly distinguish additions, removals, context, and file headers.
* Preserve raw patch text.
* Support copying and downloading the original patch.
* Handle large diffs without freezing the UI.
* Do not incorrectly treat ordinary code as a diff.

#### Acceptance criteria

* Valid unified diffs render correctly.
* Added and removed lines are visually distinct.
* The original patch remains recoverable.
* Invalid diff text degrades to a normal code block.

---

### Ticket 8 — Build a secure code-execution backend

#### Goal

Provide the backend foundation required by the code-block Run button.

#### Requirements

* Use an isolated execution environment.
* Docker or a comparably strong sandbox is allowed.
* Do not execute user or model code inside the main application process.
* Enforce:

  * Time limits
  * Memory limits
  * CPU limits
  * Output-size limits
  * Process limits
  * Temporary filesystem isolation
  * Cleanup after execution
* Prevent access to application secrets.
* Prevent access to the application database.
* Prevent access to the host filesystem.
* Disable network access by default unless a specific runtime requires an explicitly approved policy.
* Design the runtime system so additional languages can be added later.
* Initially support at least:

  * Python
  * JavaScript
  * TypeScript, if practical within the chosen runner
* Return structured:

  * Standard output
  * Standard error
  * Exit status
  * Timeout status
  * Runtime metadata

#### Acceptance criteria

* Code executes outside the application process.
* Infinite loops terminate.
* Excessive output is truncated safely.
* Temporary files are deleted.
* Secrets and host files are inaccessible.
* Structured results are returned to the frontend.

---

### Ticket 9 — Add the Run button and execution output

#### Goal

Connect eligible code blocks to the secure execution backend.

#### Required interface

* Run button
* Running state
* Standard output
* Error output
* Exit status
* Timeout state

#### Requirements

* Show Run only for supported languages.
* Disable duplicate execution while a run is active.
* Keep output associated with the correct code block.
* Preserve output when the surrounding message rerenders.
* Make failures readable without exposing sensitive backend details.

#### Acceptance criteria

* Supported code blocks can be run.
* Output appears beneath or alongside the correct block.
* Errors are clearly labeled.
* Timeouts are clearly labeled.
* Unsupported languages do not show a misleading Run button.

---

### Ticket 10 — Add test-output presentation

#### Goal

Present recognized test-run output separately from generic program output.

#### Requirements

* Allow structured execution results to designate test results.
* Show:

  * Passed tests
  * Failed tests
  * Skipped tests
  * Total duration when available
* Preserve raw output.
* Do not falsely parse arbitrary output as test results.

#### Acceptance criteria

* Structured test output receives a dedicated presentation.
* Raw output remains available.
* Generic runs continue using normal output presentation.

---

### Ticket 11 — Add safe Apply Patch behavior

#### Goal

Allow applicable diff blocks to be applied to a writable code-project artifact or project context.

#### Requirements

* Apply Patch must only appear when a valid writable target exists.
* Validate patch paths.
* Prevent path traversal.
* Prevent writes outside the permitted project root.
* Show a clear result:

  * Applied
  * Partially applied
  * Conflict
  * Rejected
* Never silently overwrite unrelated changes.
* Preserve an undoable or reviewable change history using the repository’s existing editing/versioning architecture.
* If no writable target exists, omit or disable the action with a clear explanation.

#### Acceptance criteria

* Valid patches apply to the intended files.
* Invalid or unsafe paths are rejected.
* Conflicts are surfaced.
* Unrelated files remain untouched.

---

# Phase 3 — Chat folders

### Ticket 12 — Add folder data and persistence

#### Goal

Add persistent folders for organizing chats.

#### Requirements

* Use the existing database and persistence patterns.
* Folders must support:

  * Name
  * Stable identifier
  * Creation timestamp
  * Updated timestamp
  * Optional ordering
* A chat may belong to a folder.
* Existing chats must remain valid without a folder.
* Use additive, backward-compatible migrations only.
* Preserve chats if a folder is deleted.

#### Acceptance criteria

* Folders persist after reload.
* Chats can be assigned and unassigned.
* Existing chats remain accessible.
* Deleting a folder does not delete its chats unless the existing product explicitly presents and confirms that separate action.

---

### Ticket 13 — Add folder management to the chat interface

#### Goal

Expose chat folders in the existing chat-navigation UI.

#### Requirements

Support:

* Create folder
* Rename folder
* Delete folder
* Move chat into folder
* Remove chat from folder
* Expand and collapse folders
* Persist folder state when appropriate

Reuse existing sidebar, menu, and dialog patterns.

#### Acceptance criteria

* Folder operations work without full-page reloads.
* Chats display under the correct folder.
* Unfiled chats remain accessible.
* Chat search still finds chats regardless of folder.
* Existing chat actions continue working.

---

# Phase 4 — Skills

### Ticket 14 — Create the skills domain model

#### Goal

Add first-class reusable skills.

A skill is a reusable instruction package that can influence model behavior without duplicating instructions in every chat.

#### Minimum skill data

* Name
* Description
* Instructions
* Enabled/disabled state
* Optional compatible modes
* Optional required tools
* Creation and update timestamps

#### Requirements

* Use the existing persistence architecture.
* Keep the schema extensible for future:

  * Reference files
  * Scripts
  * Import/export
  * Versioning
  * Marketplace installation
* Do not implement a marketplace in this ticket.
* Use additive migrations.

#### Acceptance criteria

* Skills can be created, read, updated, and deleted through the application’s domain layer.
* Disabled skills are not applied.
* Existing chats work without skills.

---

### Ticket 15 — Add skills management UI

#### Goal

Allow the user to manage skills through the application.

#### Required actions

* View skill library
* Create skill
* Edit skill
* Delete skill
* Enable or disable skill
* Attach or detach a skill from a chat

#### Requirements

* Reuse existing settings, modal, form, and sidebar components.
* Validate required fields.
* Clearly show which skills are active for the current chat.
* Do not overload the primary chat interface.

#### Acceptance criteria

* Skill lifecycle operations work.
* Skill activation state persists.
* A skill can be attached to and removed from a chat.
* Deleting a skill safely removes references to it.

---

### Ticket 16 — Integrate skills into model execution

#### Goal

Make active skills change actual model behavior.

#### Requirements

* Inject active skill instructions into the model context through a structured prompt layer.
* Do not concatenate skills into user-visible messages.
* Preserve a deterministic order.
* Avoid duplicate injection.
* Respect required-tool declarations.
* Clearly handle a skill whose required tool is disabled.
* Keep skill instructions separate from the core system prompt so they are maintainable and debuggable.
* Ensure all currently supported model providers receive equivalent skill context.

#### Acceptance criteria

* Enabling a skill measurably changes model instructions.
* Disabling it removes that behavior.
* Skills work across new messages in the chat.
* Tool requirements are enforced or clearly reported.
* Existing provider integrations remain functional.

---

# Phase 5 — Input modes

### Ticket 17 — Build the input-mode framework

#### Goal

Create a reusable framework where input modes alter actual behavior rather than only changing a label.

#### Modes

* Ask
* Write
* Analyze
* Search
* Code
* Plan
* Execute
* Study
* Brainstorm
* Deep Research

#### Each mode may control

* Mode-specific instructions
* Tool policy
* Search behavior
* Allowed actions
* Response structure
* Reasoning depth
* Artifact preference
* Code-execution preference
* Compatible skills

#### Requirements

* Keep mode definitions centralized and extensible.
* Preserve the selected mode for the current chat.
* Make mode context available to backend model orchestration.
* Do not fork the entire message pipeline for each mode.

#### Acceptance criteria

* Every mode has a structured configuration.
* The selected mode reaches the model backend.
* Changing modes affects subsequent messages.
* Adding a future mode does not require rewriting the chat system.

---

### Ticket 18 — Implement Ask, Write, Analyze, Search, and Code modes

#### Required behavior

**Ask**

* General-purpose answers
* Uses enabled search and tools
* Balanced response depth

**Write**

* Prioritizes polished writing
* Uses artifacts when appropriate
* Avoids unnecessary execution actions
* Still researches factual claims when search is enabled

**Analyze**

* Prioritizes structured analysis
* Uses relevant documents, calculations, and code tools
* Separates evidence from inference

**Search**

* Prioritizes web retrieval
* Uses multiple targeted queries when useful
* Emphasizes sources and citations

**Code**

* Prioritizes implementation-quality code
* Uses structured code blocks
* Uses execution and testing when appropriate
* Includes filenames and language metadata when useful

#### Acceptance criteria

* These modes produce materially different instructions and tool behavior.
* Mode differences are covered by tests.
* Modes are not cosmetic labels.

---

### Ticket 19 — Implement Plan, Execute, Study, Brainstorm, and Deep Research modes

#### Required behavior

**Plan**

* Produces plans and architecture
* Does not perform mutating actions
* Does not claim execution occurred

**Execute**

* Uses enabled tools and actions to complete work
* Reports actual results
* Does not merely provide instructions when execution is available and appropriate

**Study**

* Uses explanatory, instructional structure
* Breaks concepts into manageable steps
* Includes checks for understanding when appropriate

**Brainstorm**

* Generates multiple distinct possibilities
* Clearly separates factual claims from speculative ideas
* Avoids premature convergence

**Deep Research**

* Performs multiple rounds of retrieval
* Triangulates important claims
* Prioritizes primary and authoritative sources
* Produces detailed claim-level citations

#### Acceptance criteria

* These modes change actual behavior.
* Plan mode prevents mutating actions.
* Execute mode can invoke enabled actions.
* Deep Research performs more extensive retrieval than ordinary Ask mode.
* Existing tools continue respecting the user’s enabled/disabled settings.

---

# Phase 6 — Default web research behavior

### Ticket 20 — Make web research the default pre-response behavior

#### Goal

When the search tool is enabled, the assistant should research before every response to reduce unsupported or outdated claims.

#### Requirements

* Search is enabled by default through the existing tools system.
* If the user disables the search tool, no mandatory web search occurs.
* When enabled, the assistant should generally perform approximately two or three useful search queries before answering.
* Two or three is guidance, not a meaningless quota.
* The system should prefer:

  * Distinct queries
  * Current sources
  * Primary sources
  * Queries targeted to uncertain claims
* Avoid duplicate or irrelevant searches merely to reach a count.
* Apply this behavior to all response categories, including casual prompts, unless search is disabled.
* For simple prompts, searches may be lightweight but should still be relevant.
* Preserve the existing search tool implementation rather than replacing it.

#### Acceptance criteria

* Enabled search is invoked before responses.
* Disabled search remains disabled.
* Search queries are visible in the current tool activity UI.
* Search does not repeatedly issue identical queries.
* Existing model providers support the same policy.

---

### Ticket 21 — Preserve search errors and source visibility

#### Goal

Preserve and strengthen the existing search failure behavior.

#### Requirements

* If search fails:

  * Show the tool error through the existing tool-error flow.
  * Return control to the model.
  * Let the model decide whether it can answer safely.
* Do not fabricate search results.
* Do not hide source activity.
* Whenever search runs, sources must be visible.
* The model should explicitly acknowledge material retrieval limitations when they affect the answer.

#### Acceptance criteria

* Search failures do not crash the conversation.
* Errors are visible.
* The model can continue when appropriate.
* Successful searches always expose their sources.

---

# Phase 7 — Claim-level citations

### Ticket 22 — Create a unified citation data model

#### Goal

Support citations from:

* Web sources
* Uploaded documents
* Artifacts

#### Citation data must support

* Citation number
* Source type
* Source title
* Publisher or document name
* URL or internal source identifier
* Exact claim span in the answer
* Source location:

  * URL
  * Page
  * Paragraph
  * Line
  * Artifact section
  * Other precise locator
* Supporting excerpt or source metadata
* Message association

#### Requirements

* One source may support multiple claims.
* One claim may use multiple sources.
* Citation numbering must remain stable after streaming completes.
* Citation metadata must persist with the message.
* Preserve compatibility with existing messages.

#### Acceptance criteria

* Web, document, and artifact citations share one consistent model.
* Claim-to-source mappings are persisted.
* Old messages continue rendering.

---

### Ticket 23 — Require sourcing for non-obvious factual claims

#### Goal

Update the model instruction layer so factual claims beyond obvious common knowledge are supported by citations.

#### Requirements

The system prompt must instruct the model:

* Cite non-obvious factual claims.
* Cite current claims.
* Cite numerical claims.
* Cite claims about products, people, organizations, laws, medicine, science, history, software, and news.
* Attach citations to the exact supported claim.
* Do not attach a citation to an unrelated sentence.
* Do not cite a source merely because it discusses the same general topic.
* Avoid making factual claims unsupported by retrieved evidence.
* Clearly label inference when inference is necessary.
* Prefer removing an unsupported claim over presenting it as fact.

Obvious common knowledge, such as ordinary observations like “the sky appears blue,” does not require forced citation.

#### Acceptance criteria

* The instruction applies across all supported model providers.
* Citation instructions do not appear as visible user messages.
* Responses use claim-level citations when sources are available.

---

### Ticket 24 — Add inline citation markers and claim highlighting

#### Goal

Render citations as numbered markers such as `[1]`.

#### Required behavior

* The citation marker appears immediately after the supported claim.
* Clicking `[1]` highlights the exact claim or claim span it supports.
* Clicking or activating the marker reveals the associated source label, for example:

  * `[New York Times — Article Title]`
* The source list remains available at the end of the message.
* Multiple citations may support one claim.
* One citation may support multiple claims.

#### Requirements

* Highlight only the model-designated supported claim span.
* Preserve keyboard accessibility.
* Preserve normal text selection.
* Do not break Markdown rendering or streaming.
* Resolve citation markers safely after streaming.

#### Acceptance criteria

* Clicking a marker highlights the correct claim.
* The correct source label is shown.
* Citation numbering matches the footer source list.
* Multiple citations work correctly.
* Keyboard users can activate citations.

---

### Ticket 25 — Add citation destination behavior

#### Web citations

* Clicking the source title opens the original webpage in a new tab.
* Use safe external-link attributes.
* Do not route web citations to an unrelated search-result page.

#### Uploaded-document citations

* Clicking the source opens the original uploaded document.
* Navigate to the relevant page whenever the format has pages.
* Use the exact original upload, not reconstructed chunk text.

#### Artifact citations

* Open the relevant artifact.
* Navigate to or highlight the cited artifact section when possible.

#### Acceptance criteria

* Web sources open the correct original URL.
* Document citations open the correct upload and page.
* Artifact citations open the correct artifact.
* Missing source locations fail gracefully.

---

### Ticket 26 — Preserve citations in exports

#### Goal

Keep citations when messages or artifacts are exported.

#### Requirements

* Preserve visible citation numbers.
* Preserve source titles.
* Preserve URLs or document references.
* Use footnotes, endnotes, hyperlinks, or the most appropriate mechanism for the export type.
* Do not export citation markers with no corresponding source.
* Verify exported citation destinations are relevant.

#### Acceptance criteria

* Exported documents contain readable citations.
* Citation numbers map to sources.
* Web links remain clickable when the format supports links.
* Document references identify the uploaded source and page.

---

# Phase 8 — Uploaded-document viewing

### Ticket 27 — Add original-upload viewing

#### Goal

Allow the user to view the exact uploaded file before chunking or parsing.

#### Supported file categories

Support all upload types currently accepted by the application, including:

* PDF
* Word documents
* Presentations
* Spreadsheets
* CSV
* Markdown
* Plain text
* Source code
* Images
* Other currently supported uploads

#### Requirements

* Do not reconstruct the original view from parsed chunks.
* Use the stored original upload.
* Preserve the existing parsed view.
* Copy the interaction and layout conventions of the existing artifact sidebar.
* Reuse existing file-preview infrastructure when present.
* Do not create an unrelated document-viewing interface.
* Preserve existing parsing, chunking, partial-processing, and error behavior.

#### Acceptance criteria

* Clicking an uploaded document can open the exact original upload.
* Parsed content remains available.
* Original content is not replaced by chunked text.
* Existing upload processing still works.

---

### Ticket 28 — Integrate parsed and original views into the artifact-style sidebar

#### Goal

Use the existing artifact sidebar interaction model for uploaded documents.

#### Requirements

* Inspect the existing artifact sidebar and parsed-document view.
* Reuse its:

  * Opening behavior
  * Closing behavior
  * Sizing
  * Navigation
  * Tabs or view switching
  * Responsive desktop layout
* Provide access to:

  * Existing parsed view
  * Original uploaded view
* Document citations must use this viewer and navigate to the relevant page.
* Do not redesign existing parsed-document functionality.

#### Acceptance criteria

* Parsed and original representations are both accessible.
* Switching views does not lose the current document.
* Citation navigation opens the relevant page.
* The experience is consistent with artifact viewing.

---

# Phase 9 — Artifact foundation

### Ticket 29 — Audit and formalize the artifact type registry

#### Goal

Ensure the artifact architecture can consistently create and edit all required artifact types.

#### Required artifact categories

* Markdown documents
* Word documents
* PDFs
* Presentations
* Spreadsheets
* Charts
* Images
* Code projects
* HTML pages
* Reports
* Forms

#### Requirements

* Inspect what already exists.
* Do not duplicate working artifact systems.
* Create or improve a centralized artifact-type registry if the existing architecture needs one.
* Each type must define:

  * Identifier
  * Display name
  * Source representation
  * Rendered representation
  * Creation behavior
  * Editing behavior
  * Export behavior
  * Supported citation locations
* Preserve existing artifacts and stored data.
* Use additive migrations if required.

#### Acceptance criteria

* Every required type is represented in the artifact architecture.
* Existing artifacts still open.
* Artifact creation and editing use consistent contracts.
* New types can be added without rewriting the entire artifact system.

---

# Phase 10 — Executable HTML and SVG artifacts

### Ticket 30 — Add raw-source and compiled-preview behavior for HTML artifacts

#### Goal

Make HTML artifacts behave like the existing document artifact interface.

#### Required mapping

* The area currently used for raw, unrendered Markdown becomes the raw HTML source.
* The area currently used for rendered Markdown becomes the compiled HTML preview.

#### Requirements

* Reuse the existing artifact sidebar and editing lifecycle.
* Allow the model to create HTML artifacts automatically, as it can with current artifacts.
* Allow HTML, CSS, and JavaScript.
* Allow external resources, including remote images, fonts, libraries, and APIs.
* Render inside a sandboxed iframe or equivalent isolated environment.
* Do not execute artifact JavaScript in the main application origin.
* Prevent artifact code from:

  * Accessing application secrets
  * Reading the main application DOM
  * Navigating the top-level app
  * Accessing authentication tokens
  * Reading arbitrary uploaded files
* Do not add a new artifact toolbar or extra controls.
* Preserve the controls already used by the existing artifact system.

#### Acceptance criteria

* Raw HTML is visible in the source side.
* The compiled page appears in the rendered side.
* JavaScript runs inside the artifact preview.
* External resources can load when permitted by browser security.
* Artifact code cannot access the host application.
* Existing document artifacts still work.

---

### Ticket 31 — Add raw-source and compiled-preview behavior for SVG artifacts

#### Goal

Support editable SVG artifacts using the same source/preview model.

#### Requirements

* Raw SVG source appears where raw Markdown currently appears.
* Rendered SVG appears where rendered Markdown currently appears.
* Support SVG scripts only through the same sandboxed execution environment as HTML.
* Preserve SVG dimensions, viewBox, styles, gradients, filters, masks, and embedded definitions.
* Handle malformed SVG safely.
* Do not allow inline SVG to execute directly in the application DOM.
* Do not add new controls.

#### Acceptance criteria

* Valid SVG renders correctly.
* Raw SVG remains editable.
* Malformed SVG shows a safe error state.
* SVG script execution cannot escape the sandbox.
* Existing artifact functionality is unaffected.

---

### Ticket 32 — Preserve artifact editing behavior for executable artifacts

#### Goal

Make HTML and SVG editing follow the repository’s existing artifact-update behavior.

#### Requirements

* Inspect how current artifacts are:

  * Created
  * Updated
  * Replaced
  * Versioned
  * Persisted
  * Associated with chats
* Copy that behavior.
* Do not invent a separate artifact-history model.
* When the model edits HTML or SVG, update it through the same lifecycle as current document artifacts.
* Ensure preview refreshes after edits without losing chat state.

#### Acceptance criteria

* HTML and SVG can be created and edited.
* Changes persist.
* Existing artifact version/update behavior is preserved.
* Refreshing or reopening a chat restores the correct artifact.

---

# Phase 11 — Document artifacts

### Ticket 33 — Verify and complete Markdown, Word, and PDF artifact support

#### Goal

Ensure the model can create and edit:

* Markdown documents
* Word documents
* PDFs

#### Requirements

* Inspect existing support first.
* Preserve existing document artifact behavior.
* Creation and editing may use an internal structured representation and regenerate exported files.
* Generated files must open in standard applications.
* Preserve formatting during ordinary edits.
* Support citations in exported files.
* Do not falsely claim a file was generated if export failed.

#### Acceptance criteria

* Each type can be created.
* Existing artifacts can be edited.
* Files export successfully.
* Exported files open correctly.
* Citations are preserved.

---

### Ticket 34 — Verify and complete presentation artifact support

#### Goal

Allow creation and editing of presentation artifacts.

#### Requirements

Support:

* Multiple slides
* Titles
* Body text
* Images
* Basic diagrams
* Speaker notes when supported
* Consistent themes
* Export to a standard presentation format

Reuse existing artifact patterns.

#### Acceptance criteria

* Presentations can be created and edited.
* Slide ordering persists.
* Exported presentations open correctly.
* Basic styling is preserved.
* Citations remain associated with relevant slides or notes.

---

# Phase 12 — Advanced spreadsheet tooling

### Ticket 35 — Build the spreadsheet workbook model

#### Goal

Create a structured workbook artifact capable of representing:

* Multiple worksheets
* Cell values
* Cell formulas
* Formatting
* Merged cells
* Rows and columns
* Named ranges where supported
* Tables
* Validation
* Charts

#### Requirements

* Use a mature spreadsheet library.
* Preserve formulas as formulas rather than converting them only to displayed values.
* Keep workbook generation separate from UI rendering.
* Support future editing.
* Use the existing artifact lifecycle.
* Export to `.xlsx`.

#### Acceptance criteria

* A workbook with multiple sheets can be generated.
* Values and formulas persist.
* The exported workbook opens in standard spreadsheet applications.
* Existing spreadsheet artifacts remain compatible.

---

### Ticket 36 — Add advanced spreadsheet formatting

#### Goal

Generate professionally formatted workbooks.

#### Required formatting

* Fonts
* Font sizes
* Bold, italic, underline
* Text and number alignment
* Number formats
* Currency formats
* Percentage formats
* Dates and times
* Borders
* Fills
* Row heights
* Column widths
* Freeze panes
* Conditional formatting where supported
* Merged cells where appropriate

#### Acceptance criteria

* Formatting appears correctly in the exported workbook.
* Formatting does not corrupt formulas.
* Generated sheets are readable without extensive manual cleanup.
* Large sheets remain performant.

---

### Ticket 37 — Add spreadsheet formulas, tables, and validation

#### Goal

Support functional workbook logic.

#### Requirements

* Generate formulas using standard spreadsheet syntax.
* Support cross-sheet formulas.
* Support structured tables.
* Support data validation, including:

  * Dropdown lists
  * Numeric ranges
  * Date ranges
  * Custom validation where supported
* Preserve formulas and validation in exports.
* Avoid formulas that reference invalid ranges.

#### Acceptance criteria

* Formula cells calculate when opened in a compatible spreadsheet application.
* Cross-sheet references are valid.
* Tables are recognized as tables.
* Validation rules operate correctly.
* Invalid workbook references are caught by tests or validation.

---

### Ticket 38 — Add spreadsheet charts

#### Goal

Generate charts from workbook data.

#### Supported chart categories

At minimum:

* Line
* Bar
* Column
* Pie
* Scatter

#### Requirements

* Charts must reference workbook ranges.
* Support titles, legends, axes, and basic labels.
* Place charts without covering critical data.
* Preserve charts in `.xlsx` export.
* Allow the model to modify chart configuration when editing the artifact.

#### Acceptance criteria

* Every required chart type can be generated.
* Chart ranges reference valid data.
* Charts appear in exported workbooks.
* Editing chart configuration updates the result.

---

### Ticket 39 — Add spreadsheet artifact preview

#### Goal

Display spreadsheet artifacts inside the existing artifact interface.

#### Requirements

* Use the existing artifact sidebar.
* Allow worksheet selection.
* Display formulas or values according to the existing artifact-view conventions.
* Display tables and basic formatting.
* Display charts when supported.
* Keep preview rendering separate from exported workbook generation.
* Do not require opening the downloaded `.xlsx` to inspect basic content.

#### Acceptance criteria

* Multiple sheets can be viewed.
* Cell data is readable.
* Basic formatting is visible.
* Charts appear or have a clear preview representation.
* Large sheets do not freeze the application.

---

# Phase 13 — Remaining artifact types

### Ticket 40 — Complete standalone chart artifact support

#### Goal

Allow the model to create and edit chart artifacts independently of spreadsheets.

#### Requirements

Support common chart data, labels, axes, titles, legends, and export.

Charts must use structured data rather than being stored only as screenshots.

#### Acceptance criteria

* Charts can be created from structured data.
* Chart data can be edited.
* Charts render in the artifact sidebar.
* Charts can be exported in an appropriate format.

---

### Ticket 41 — Complete image artifact support

#### Goal

Allow the model to create, display, and edit image artifacts through supported image-generation or image-processing workflows.

#### Requirements

* Preserve metadata about how the image was produced.
* Support standard web image formats.
* Reuse the artifact sidebar.
* Do not pretend arbitrary image edits succeeded when no image tool performed them.
* Keep original and edited versions associated according to existing artifact behavior.

#### Acceptance criteria

* Image artifacts display correctly.
* Generated image files are preserved.
* Supported edits create updated artifacts.
* Unsupported edits return an honest error.

---

### Ticket 42 — Complete code-project artifact support

#### Goal

Allow the model to create and edit multi-file code-project artifacts.

#### Requirements

Support:

* Multiple files
* Directory structure
* File contents
* Language metadata
* Project manifest metadata
* Safe editing
* Diff generation
* Integration with Apply Patch
* Integration with code execution when supported

Use the existing artifact interface and add only the project navigation required by the artifact type.

#### Acceptance criteria

* Multi-file projects can be created.
* Individual files can be edited.
* Directory structure persists.
* Patches target the correct files.
* Code cannot write outside the project artifact root.

---

### Ticket 43 — Complete HTML-page artifact support

#### Goal

Support full HTML-page artifacts using the executable HTML artifact infrastructure.

#### Requirements

* HTML pages may include:

  * HTML
  * CSS
  * JavaScript
  * External resources
* Use the sandboxed preview.
* Keep source editable.
* Preserve the existing artifact controls.
* Do not provide arbitrary access to uploaded files or application state.

#### Acceptance criteria

* Full pages render.
* Scripts run in the sandbox.
* Source edits update the preview.
* Application secrets and DOM remain inaccessible.

---

### Ticket 44 — Complete report artifact support

#### Goal

Allow the model to create and edit structured reports.

#### Reports may contain

* Title page
* Executive summary
* Headings
* Tables
* Charts
* Images
* Findings
* Recommendations
* Citations
* Appendices

#### Requirements

* Reports must be structured artifacts rather than only long chat messages.
* Support export to appropriate document formats.
* Preserve claim-level citations in exports.
* Reuse document and chart artifact infrastructure.

#### Acceptance criteria

* Reports can be created and edited.
* Tables and charts render correctly.
* Exports open correctly.
* Citations are preserved.

---

### Ticket 45 — Complete form artifact support

#### Goal

Allow the model to create and edit interactive form artifacts.

#### Form elements may include

* Text inputs
* Text areas
* Select menus
* Checkboxes
* Radio buttons
* Dates
* Numbers
* Validation rules
* Sections
* Submit behavior appropriate to the existing application

#### Requirements

* Represent the form using structured data or safe generated HTML.
* Render interactive forms in an isolated preview.
* Do not send form data to arbitrary external endpoints without explicit configuration.
* Preserve form schemas for later editing.
* Reuse the HTML artifact sandbox when appropriate.

#### Acceptance criteria

* Forms render and accept local input.
* Validation works.
* Form schema can be edited.
* Form code cannot access the host application.
* External submission is disabled unless explicitly configured.

---

# Final integration and completion

After Ticket 45:

1. Confirm every ticket is marked complete.
2. Confirm every OpenCode ticket session has finished.
3. Confirm all required ticket commits exist.
4. Inspect the full commit range.
5. Run:

   * Complete test suite
   * Lint
   * Type checking
   * Production build
   * Database migration validation
6. Test the complete user flow manually where automation is insufficient:

   * Open chats
   * Reach the bottom of a long chat
   * Search chats
   * Organize chats into folders
   * Activate skills
   * Switch modes
   * Send a message with search enabled
   * Send a message with search disabled
   * Inspect citations
   * Open a web citation
   * Open an uploaded-document citation
   * View parsed and original uploads
   * Render code blocks
   * Run code
   * View output and errors
   * Apply a safe patch
   * Create HTML and SVG artifacts
   * Execute JavaScript inside an artifact
   * Create and export a spreadsheet
   * Create and export each supported artifact type
7. Fix any integration regressions through OpenCode.
8. Ensure the working tree is clean.
9. Push all commits to `main`.
10. Report:

* Tickets completed
* Commits created
* Tests run
* Final test results
* Build result
* Migration result
* Final pushed commit SHA
* Any known limitations

The project is complete only when all tickets are implemented, validated, committed, and pushed to `main`.
