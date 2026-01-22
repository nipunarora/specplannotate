/**
 * Speckit utilities for spec-kit document review
 *
 * Detects spec-kit feature directories based on git branch name and combines
 * multiple specification documents (spec.md, plan.md, tasks.md, etc.) into
 * a single markdown document for review in the Plannotator UI.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { getCurrentBranch } from "./git";

// --- Types ---

export interface SpeckitContext {
  /** Current git branch name */
  branchName: string;
  /** Path to the spec directory (e.g., "specs/add-dark-mode") */
  specDir: string;
  /** Path to constitution file (e.g., "memory/constitution.md") */
  constitutionPath: string;
  /** Spec files that exist */
  foundFiles: string[];
  /** Required spec files that are missing */
  missingFiles: string[];
}

export interface FileMapping {
  /** Source file path (relative to project root) */
  filePath: string;
  /** Start character offset in combined markdown */
  startOffset: number;
  /** End character offset in combined markdown */
  endOffset: number;
  /** Original file content */
  originalContent: string;
}

export interface SpeckitResult {
  /** Combined markdown content */
  markdown: string;
  /** Feature/branch name */
  featureName: string;
  /** List of included files */
  includedFiles: string[];
  /** Mapping of character ranges to source files */
  fileMappings: FileMapping[];
}

export interface SpeckitAnnotation {
  type: "DELETION" | "REPLACEMENT" | "INSERTION" | "COMMENT";
  originalText: string;
  text?: string; // For replacement/insertion
}

// --- Constants ---

// Files to look for in the spec directory (in order of display)
const SPEC_FILES = [
  { name: "spec.md", label: "Specification", required: true },
  { name: "plan.md", label: "Technical Plan", required: true },
  { name: "tasks.md", label: "Tasks", required: true },
  { name: "research.md", label: "Research", required: false },
  { name: "data-model.md", label: "Data Model", required: false },
  { name: "quickstart.md", label: "Quick Start", required: false },
];

// --- Functions ---

/**
 * Detect spec-kit context from current git branch
 *
 * @returns SpeckitContext if a spec directory exists for the current branch, null otherwise
 */
export async function detectSpeckitContext(): Promise<SpeckitContext | null> {
  const branchName = await getCurrentBranch();

  // Detached HEAD or special states
  if (branchName === "HEAD") {
    return null;
  }

  const specDir = join("specs", branchName);
  const constitutionPath = join("memory", "constitution.md");

  // Check if spec directory exists
  if (!existsSync(specDir) || !statSync(specDir).isDirectory()) {
    return null;
  }

  // Scan for spec files
  const foundFiles: string[] = [];
  const missingFiles: string[] = [];

  for (const { name, required } of SPEC_FILES) {
    const filePath = join(specDir, name);
    if (existsSync(filePath)) {
      foundFiles.push(name);
    } else if (required) {
      missingFiles.push(name);
    }
  }

  // Also check for contracts directory
  const contractsDir = join(specDir, "contracts");
  if (existsSync(contractsDir) && statSync(contractsDir).isDirectory()) {
    const contractFiles = readdirSync(contractsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => `contracts/${f}`);
    foundFiles.push(...contractFiles);
  }

  return {
    branchName,
    specDir,
    constitutionPath,
    foundFiles,
    missingFiles,
  };
}

/**
 * Read a file and return its content, or null if it doesn't exist
 */
async function readFileContent(path: string): Promise<string | null> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    return await file.text();
  } catch {
    return null;
  }
}

/**
 * Combine all spec-kit documents into a single markdown document
 *
 * Format:
 * - YAML frontmatter with feature name and file list
 * - Constitution section (if exists)
 * - Each spec file as a section with header and horizontal rule
 * - Missing required files shown with placeholder note
 *
 * Also tracks file mappings for applying annotations back to source files.
 */
export async function combineSpeckitDocuments(
  ctx: SpeckitContext
): Promise<SpeckitResult> {
  const includedFiles: string[] = [];
  const fileMappings: FileMapping[] = [];
  let combinedMarkdown = "";

  // YAML frontmatter
  const fileList = ctx.foundFiles.join(", ");
  const missingList = ctx.missingFiles.length > 0
    ? ` (missing: ${ctx.missingFiles.join(", ")})`
    : "";

  combinedMarkdown += `---
feature: ${ctx.branchName}
files: ${fileList}${missingList}
---\n\n`;

  // Feature heading
  combinedMarkdown += `# Feature: ${ctx.branchName}\n\n`;

  // Constitution (optional)
  const constitutionContent = await readFileContent(ctx.constitutionPath);
  if (constitutionContent) {
    const sectionHeader = `## Constitution\n\n`;
    combinedMarkdown += sectionHeader;

    const contentStart = combinedMarkdown.length;
    const trimmedContent = constitutionContent.trim();
    combinedMarkdown += trimmedContent;
    const contentEnd = combinedMarkdown.length;

    fileMappings.push({
      filePath: ctx.constitutionPath,
      startOffset: contentStart,
      endOffset: contentEnd,
      originalContent: trimmedContent,
    });

    combinedMarkdown += `\n\n---\n\n`;
    includedFiles.push("memory/constitution.md");
  }

  // Main spec files
  for (const { name, label, required } of SPEC_FILES) {
    const filePath = join(ctx.specDir, name);
    const content = await readFileContent(filePath);

    if (content) {
      const sectionHeader = `## ${label}\n\n`;
      combinedMarkdown += sectionHeader;

      const contentStart = combinedMarkdown.length;
      const trimmedContent = content.trim();
      combinedMarkdown += trimmedContent;
      const contentEnd = combinedMarkdown.length;

      fileMappings.push({
        filePath: filePath,
        startOffset: contentStart,
        endOffset: contentEnd,
        originalContent: trimmedContent,
      });

      combinedMarkdown += `\n\n---\n\n`;
      includedFiles.push(name);
    } else if (required) {
      combinedMarkdown += `## ${label}\n\n*${name} not found - please create this file*\n\n---\n\n`;
    }
  }

  // Contract files
  const contractFiles = ctx.foundFiles.filter((f) => f.startsWith("contracts/"));
  if (contractFiles.length > 0) {
    combinedMarkdown += `## API Contracts\n\n`;

    for (const contractFile of contractFiles) {
      const filePath = join(ctx.specDir, contractFile);
      const content = await readFileContent(filePath);
      if (content) {
        const contractName = basename(contractFile, ".md");
        combinedMarkdown += `### ${contractName}\n\n`;

        const contentStart = combinedMarkdown.length;
        const trimmedContent = content.trim();
        combinedMarkdown += trimmedContent;
        const contentEnd = combinedMarkdown.length;

        fileMappings.push({
          filePath: filePath,
          startOffset: contentStart,
          endOffset: contentEnd,
          originalContent: trimmedContent,
        });

        combinedMarkdown += `\n\n`;
        includedFiles.push(contractFile);
      }
    }

    combinedMarkdown += `---\n\n`;
  }

  return {
    markdown: combinedMarkdown.trimEnd(),
    featureName: ctx.branchName,
    includedFiles,
    fileMappings,
  };
}

/**
 * Apply annotations to source spec files
 *
 * Finds which source file contains the annotated text and applies the modification.
 * Supports DELETION, REPLACEMENT, and INSERTION types.
 */
export async function applyAnnotationsToFiles(
  annotations: SpeckitAnnotation[],
  fileMappings: FileMapping[]
): Promise<{ success: boolean; modifiedFiles: string[]; errors: string[] }> {
  const errors: string[] = [];
  const modifiedFiles: string[] = [];

  // Group annotations by file
  const fileChanges = new Map<string, { content: string; changes: Array<{ start: number; end: number; replacement: string }> }>();

  // Initialize with current file contents
  for (const mapping of fileMappings) {
    const currentContent = await readFileContent(mapping.filePath);
    if (currentContent) {
      fileChanges.set(mapping.filePath, { content: currentContent, changes: [] });
    }
  }

  // Process each annotation
  for (const annotation of annotations) {
    if (annotation.type === "COMMENT") continue; // Comments don't modify files

    // Find which file contains this text
    let foundFile: string | null = null;
    let foundIndex = -1;

    for (const mapping of fileMappings) {
      const fileData = fileChanges.get(mapping.filePath);
      if (!fileData) continue;

      const index = fileData.content.indexOf(annotation.originalText);
      if (index !== -1) {
        foundFile = mapping.filePath;
        foundIndex = index;
        break;
      }
    }

    if (!foundFile || foundIndex === -1) {
      errors.push(`Could not find text "${annotation.originalText.slice(0, 50)}..." in any source file`);
      continue;
    }

    const fileData = fileChanges.get(foundFile)!;

    switch (annotation.type) {
      case "DELETION":
        fileData.changes.push({
          start: foundIndex,
          end: foundIndex + annotation.originalText.length,
          replacement: "",
        });
        break;

      case "REPLACEMENT":
        fileData.changes.push({
          start: foundIndex,
          end: foundIndex + annotation.originalText.length,
          replacement: annotation.text || "",
        });
        break;

      case "INSERTION":
        // Insert after the context text
        fileData.changes.push({
          start: foundIndex + annotation.originalText.length,
          end: foundIndex + annotation.originalText.length,
          replacement: annotation.text || "",
        });
        break;
    }
  }

  // Apply changes to each file (in reverse order to preserve offsets)
  for (const [filePath, fileData] of fileChanges) {
    if (fileData.changes.length === 0) continue;

    // Sort changes by start position descending (apply from end to start)
    fileData.changes.sort((a, b) => b.start - a.start);

    let newContent = fileData.content;
    for (const change of fileData.changes) {
      newContent = newContent.slice(0, change.start) + change.replacement + newContent.slice(change.end);
    }

    // Write the modified content back to the file
    try {
      await Bun.write(filePath, newContent);
      modifiedFiles.push(filePath);
    } catch (err) {
      errors.push(`Failed to write to ${filePath}: ${err}`);
    }
  }

  return {
    success: errors.length === 0,
    modifiedFiles,
    errors,
  };
}

/**
 * Generate an error message when no spec directory is found
 */
export function generateNoSpecError(branchName: string): string {
  if (branchName === "HEAD") {
    return `Speckit Review

Cannot determine feature name from current git state.

Current state: detached HEAD

Please checkout a feature branch that corresponds to a spec directory:
  git checkout <feature-branch>

Or create a new feature branch:
  git checkout -b <feature-name>
  mkdir -p specs/<feature-name>
`;
  }

  return `Speckit Review

No specification directory found for branch "${branchName}".

Expected location: specs/${branchName}/

To set up spec-kit for this feature:
1. Create the directory:
   mkdir -p specs/${branchName}

2. Add specification files:
   - spec.md (required) - Feature specification
   - plan.md (required) - Technical plan
   - tasks.md (required) - Implementation tasks
   - research.md (optional) - Research notes
   - data-model.md (optional) - Data structures

Learn more: https://github.com/github/spec-kit
`;
}
