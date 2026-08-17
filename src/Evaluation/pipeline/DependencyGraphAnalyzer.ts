import { PipelineContext, EvaluationModule } from './interfaces';

// Graph database of dependencies
// For each concept, specify:
// - simple requirements: list of arrays of prerequisite concept IDs (representing OR groups, e.g. [ [a], [b, c] ] means a OR (b AND c))
export const CONCEPT_DEPENDENCY_GRAPH: { [conceptId: string]: string[][] } = {
  polymorphism: [
    ['inheritance'], // path 1: requires inheritance
    ['interfaces']   // path 2: requires interfaces (multi-path!)
  ],
  inheritance: [
    ['classes']
  ],
  classes: [
    ['objects']
  ],
  linked_lists: [
    ['variables']
  ],
  stacks: [
    ['arrays'],
    ['linked_lists']
  ],
  queues: [
    ['arrays'],
    ['linked_lists']
  ],
  hash_maps: [
    ['arrays', 'functions']
  ]
};

export class DependencyGraphAnalyzer implements EvaluationModule {
  readonly name = 'DependencyGraphAnalyzer';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting DependencyGraphAnalyzer...');

    const matched = context.matchedConcepts;
    
    matched.forEach(conceptId => {
      const paths = CONCEPT_DEPENDENCY_GRAPH[conceptId];
      if (!paths || paths.length === 0) {
        // No prerequisites, automatically reached
        context.reachedDepth.push(conceptId);
        return;
      }

      // Check if any path is fully satisfied
      const satisfiedPath = paths.find(path => 
        path.every(prereqId => matched.has(prereqId))
      );

      if (satisfiedPath) {
        context.reachedDepth.push(conceptId);
        context.developerTrace.push(`Prerequisites satisfied for [${conceptId}] via path: [${satisfiedPath.join(', ')}]`);
      } else {
        // Did not satisfy prerequisites, record missing ones from the first path as example
        const firstPath = paths[0];
        const missing = firstPath.filter(prereqId => !matched.has(prereqId));
        missing.forEach(m => {
          if (!context.missedDependencies.includes(m)) {
            context.missedDependencies.push(m);
          }
        });
        context.developerTrace.push(`Prerequisites MISSED for [${conceptId}]. Missing: [${missing.join(', ')}]`);
      }
    });

    context.detectorConfidences['dependencyGraph'] = 90;
    context.developerTrace.push(`DependencyGraphAnalyzer completed. Reached depth: ${context.reachedDepth.length}, Missed: ${context.missedDependencies.length}`);
  }
}
