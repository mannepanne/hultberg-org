This is intended as an initial high level PRD. The purpose is to briefly and succinctly outline a clear problem statement, and the desired ideal outcome. It's intended as a living document that will be updated as the project progresses. It's not a complete specification, or a project plan, but acts as a guide for further documentation and planning.

For other great templates and inspiration, see [Lenny's favourites](https://www.lennysnewsletter.com/p/my-favorite-templates-issue-37).

# Project Title: {project_title}
- Last updated: {last_updated}
- Updated by: {updated_by}

### Related documents and resources
Instruction: List any additional useful resources.
- [Strategy brief - see separate template](url)
- [Document 2](url)
- [Document 3](url)

## Usage
- This template is intended for use with Claude Code alongside the files CLAUDE.md (work instructions for Claude) and PRDGENERATION.md (detailed instructions for generating PRDs).
- Copy the template and PRDGENERATION.md to a new project, place it in a folder called SPECIFICATIONS, and rename it "OnePagerRequirements.md" to match instructions in CLAUDE.md.
- Then start with a prompt similar to this to kick off the generation process:

In the folder SPECIFICATIONS you find two files. There is a template for a PRD, a Product Requirements Document, that I would like to complete in a first draft version in collaboration with you. The template we need to complete is named OnePagerRequirements.md. You also find an instruction file, PRDGENERATION.md, that explains how to work with me to ask additional questions, and how to complete the template. Please read the files and let me know if it's clear what to do before we start.

## Executive summary
Instruction: A brief overview that highlights the problem being addressed, the proposed solution, and the anticipated impact. It provides a high-level understanding of the project. This should be written last, after all other sections are complete.

{executive_summary}

## Elevator Pitch
Instruction: The core narrative of the project. Think of it as the elevator pitch that explains who this is for and why they will care.

{core_narrative}

## Description: What is this about?
Instruction: Briefly provide the background and context.

{what_is_this_about}

## Problem: What problem is this addressing?
Instruction: Write a clear problem statement, outlining pain points and challenges faced. If possible make it specific and personable, using a format like:

- I am < who >. I am trying to < outcome/job >. But < problem / barrier > because < root cause > which makes me feel < emotion >.

{what_problem_is_this_addressing}

{pain_points}

{problem_statement}

## Why: How do we know this is a real problem and worth solving?
Instruction: Motivate why this is important and justify the effort. Ideally backed by data and financial projections.

{how_do_we_know_this_is_a_real_problem_and_worth_solving}

## Audience: Who are we building for?
Instruction: Identify the target market or customer segment / persona. Highlight the potential size and relevance of the target market.

{who_are_we_building_for}

## Success: What does the ideal outcome look like?
Instruction: State the goals. Also clearly state if something is NOT a goal / expected outcome / not in scope.

{what_does_the_ideal_outcome_look_like}

{goals}

{non_goals_not_in_scope}

## Key metrics: How do we know we achieved the outcome?
Instruction: List any measurable metrics and performance indicators relevant to validate if success is achieved, and determine the impact.

{how_do_we_know_we_achieved_the_outcome}

{user_metrics}

{business_metrics}

{technical_metrics}

## Risks: What can go wrong? What are the potential mitigations?
Instruction: Identify the riskiest assumptions. Brainstorm things that could go wrong. For each risk, list appropriate mitigations.

{what_can_go_wrong}

{mitigations}

## How: What is the experiment plan?
Instruction: How will the riskiest assumptions be tested? What hypotheses will we attempt to invalidate to build confidence in our solution?

{what_is_the_experiment_plan}

## When: When does it ship and what are the milestones?
Instruction: Outline the major steps, anticipated timeline, and resources required. Include key milestones and considerations for successful execution and roll out.

{when_does_it_ship_and_what_are_the_milestones}

{project_estimate}

{team_size_composition}

{suggested phases}

## Recommendation: Where do we go next?
Instruction: List any decisions that are required, or clear steps ahead.

{where_do_we_go_next}

## Questions: Any known unknowns?
Instruction: What initial discovery and / or research do we need to complete before solutionising can start?

{any_known_unknowns}

## User story narrative
Instruction: Tell your use cases in story format, starting before the user encounters your feature and including their thoughts and motivations. Show how the feature fits into the users' lives and has a big impact.

**< user_story >**
- ID
- Title
- Description
- Acceptance criteria
**</user_story >**

{user_stories}
