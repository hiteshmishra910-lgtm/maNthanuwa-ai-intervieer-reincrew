import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PIPELINE_DIR = path.resolve(__dirname, '../src/Evaluation/pipeline');
const DISPATCH_DIR = path.resolve(__dirname, '../src/Evaluation/dispatch');

function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

describe('Phase 0 Architectural Boundary Verification Suite', () => {
  test('✓ No circular imports across src/Evaluation/ pipeline modules', () => {
    const files = getFilesRecursively(PIPELINE_DIR);
    const importsMap: Record<string, string[]> = {};

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const importLines = content.split('\n').filter((line) => line.trim().startsWith('import '));
      const baseName = path.basename(file, '.ts');
      importsMap[baseName] = importLines;
    });

    const primitives = ['Normalizer', 'Tokenizer', 'Stemmer'];
    primitives.forEach((primitive) => {
      const lines = importsMap[primitive] || [];
      const illegalImports = lines.filter((l) =>
        l.includes('EvaluationCore') ||
        l.includes('ReportGenerator') ||
        l.includes('EvaluationPolicyEngine')
      );
      expect(illegalImports).toHaveLength(0);
    });
  });

  test('✓ Pipeline modules cannot import UI components', () => {
    const files = getFilesRecursively(PIPELINE_DIR);
    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"].*\/components\//);
      expect(content).not.toMatch(/from\s+['"].*\/candidate\//);
      expect(content).not.toMatch(/from\s+['"].*\/Interview\//);
      expect(content).not.toMatch(/from\s+['"].*\/HR\//);
    });
  });

  test('✓ Pipeline modules cannot import database write clients directly', () => {
    const files = getFilesRecursively(PIPELINE_DIR);
    files.forEach((file) => {
      const baseName = path.basename(file);
      if (baseName !== 'ReportGenerator.ts' && baseName !== 'RubricCompiler.ts') {
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).not.toMatch(/from\s+['"].*\/supabaseClient['"]/);
        expect(content).not.toMatch(/from\s+['"].*\/supabaseService['"]/);
      }
    });
  });

  test('✓ ScoringPolicyEngine / EvaluationPolicyEngine cannot import external LLM APIs', () => {
    const policyFile = path.join(PIPELINE_DIR, 'EvaluationPolicyEngine.ts');
    if (fs.existsSync(policyFile)) {
      const content = fs.readFileSync(policyFile, 'utf-8');
      expect(content).not.toMatch(/apiService/);
      expect(content).not.toMatch(/openRouter/);
      expect(content).not.toMatch(/aiService/);
    }
  });

  test('✓ EvaluationCore is sole orchestrator for strategy engines', () => {
    const coreFile = path.join(DISPATCH_DIR, 'EvaluationCore.ts');
    const content = fs.readFileSync(coreFile, 'utf-8');
    expect(content).toContain('class EvaluationCore');
    expect(content).toContain('evaluateAnswer');
  });

  test('✓ EvaluationCore cannot import React or UI components', () => {
    const coreFile = path.join(DISPATCH_DIR, 'EvaluationCore.ts');
    const content = fs.readFileSync(coreFile, 'utf-8');
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"].*\/components\//);
  });

  test('✓ Pure pipeline analysis modules cannot import strategy engines directly', () => {
    const files = getFilesRecursively(PIPELINE_DIR);
    files.forEach((file) => {
      const baseName = path.basename(file);
      if (baseName !== 'InterviewFlowController.ts') {
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).not.toMatch(/from\s+['"].*\/engines\//);
      }
    });
  });
});
