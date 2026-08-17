import { EvaluationConcept } from '../../../types';

export const CONCEPT_REGISTRY: { [id: string]: EvaluationConcept } = {
  // Programming & OOP
  variables: {
    id: 'variables',
    concept: 'Variables',
    importance: 'Critical',
    aliases: ['variable', 'var', 'named storage', 'ram storage', 'store data', 'memory space', 'allocate memory'],
    examples: ['let x = 10', 'int a = 5', 'mutable reference'],
    misconceptions: ['variables hold the actual object rather than references', 'variables are always mutable']
  },
  functions: {
    id: 'functions',
    concept: 'Functions',
    importance: 'Critical',
    aliases: ['function', 'method', 'procedure', 'subroutine', 'modular code', 'code reuse', 'arguments', 'return value', 'scope'],
    examples: ['def add(x, y)', 'function return value', 'scope variable encapsulation'],
    misconceptions: ['functions must always return a value', 'methods and functions are exactly the same in all languages']
  },
  classes: {
    id: 'classes',
    concept: 'Classes',
    importance: 'Critical',
    aliases: ['class', 'blueprint', 'template', 'instantiation', 'fields', 'constructor'],
    examples: ['class Person', 'new keyword', 'blueprint of object'],
    misconceptions: ['classes occupy memory directly without instantiation', 'a class can only inherit from one other class in all languages']
  },
  objects: {
    id: 'objects',
    concept: 'Objects',
    importance: 'Critical',
    aliases: ['object', 'instance', 'state', 'behavior', 'heap memory', 'attributes'],
    examples: ['const p = new Person()', 'instance of class'],
    misconceptions: ['objects are stored in the stack', 'primitive variables are objects']
  },
  inheritance: {
    id: 'inheritance',
    concept: 'Inheritance',
    importance: 'Critical',
    aliases: ['inheritance', 'inherit', 'extends', 'parent class', 'base class', 'subclass', 'derived class', 'superclass', 'child class'],
    examples: ['class Dog extends Animal', 'base and derived class relation'],
    misconceptions: ['subclasses have access to private parent variables', 'inheritance is always better than composition']
  },
  polymorphism: {
    id: 'polymorphism',
    concept: 'Polymorphism',
    importance: 'Critical',
    aliases: ['polymorphism', 'polymorphic', 'overloading', 'overriding', 'dynamic dispatch', 'compile time polymorphism', 'run time polymorphism', 'interface implementation'],
    examples: ['method overriding', 'method overloading', 'polymorphic behavior'],
    misconceptions: ['overloading is run-time polymorphism', 'interfaces can only have abstract methods']
  },
  encapsulation: {
    id: 'encapsulation',
    concept: 'Encapsulation',
    importance: 'Critical',
    aliases: ['encapsulation', 'data hiding', 'private fields', 'access modifiers', 'getters and setters', 'encapsulating state'],
    examples: ['private variables', 'public getters/setters'],
    misconceptions: ['encapsulation is just wrapping code in functions', 'access modifiers guarantee security against reflection']
  },
  abstraction: {
    id: 'abstraction',
    concept: 'Abstraction',
    importance: 'Important',
    aliases: ['abstraction', 'abstract class', 'interfaces', 'hiding details', 'simple interface', 'essential features'],
    examples: ['abstract class Animal', 'interface shape'],
    misconceptions: ['abstraction is the same as encapsulation', 'you can instantiate an abstract class']
  },
  // Data Structures
  arrays: {
    id: 'arrays',
    concept: 'Arrays',
    importance: 'Critical',
    aliases: ['array', 'contiguous memory', 'fixed size', 'index access', 'indexing', 'linear structure'],
    examples: ['arr[0]', 'contiguous array allocation'],
    misconceptions: ['arrays dynamically resize automatically in all compiled languages', 'array search is always O(1)']
  },
  linked_lists: {
    id: 'linked_lists',
    concept: 'Linked Lists',
    importance: 'Critical',
    aliases: ['linked list', 'nodes', 'pointers', 'next pointer', 'head node', 'dynamic allocation', 'sequential access', 'linkedlist', 'doubly linked list'],
    examples: ['node.next', 'head pointer'],
    misconceptions: ['linked lists allow O(1) random access', 'linked lists require contiguous memory']
  },
  stacks: {
    id: 'stacks',
    concept: 'Stacks',
    importance: 'Critical',
    aliases: ['stack', 'lifo', 'last in first out', 'push and pop', 'call stack', 'undo operations'],
    examples: ['stack push', 'call stack execution'],
    misconceptions: ['stacks can only be implemented using arrays', 'popping from a stack is an O(N) operation']
  },
  queues: {
    id: 'queues',
    concept: 'Queues',
    importance: 'Critical',
    aliases: ['queue', 'fifo', 'first in first out', 'enqueue and dequeue', 'task scheduling', 'printer queue'],
    examples: ['enqueue operations', 'breadth first search queue'],
    misconceptions: ['queues do not support dynamic sizes', 'priority queue is a simple FIFO queue']
  },
  // Hardware & ECE
  resistors: {
    id: 'resistors',
    concept: 'Resistors',
    importance: 'Critical',
    aliases: ['resistor', 'resistance', 'ohms law', 'voltage drop', 'dissipate heat', 'current limiting'],
    examples: ['ohms law v=ir', 'resistor in series'],
    misconceptions: ['resistors generate voltage', 'ideal resistors store electric energy']
  },
  capacitors: {
    id: 'capacitors',
    concept: 'Capacitors',
    importance: 'Critical',
    aliases: ['capacitor', 'capacitance', 'charge storage', 'electric field', 'filtering noise', 'decoupling', 'dielectric material'],
    examples: ['filtering ripple voltage', 'charge discharge cycle'],
    misconceptions: ['capacitors allow continuous DC current to pass through', 'capacitors generate energy']
  },
  transistors: {
    id: 'transistors',
    concept: 'Transistors',
    importance: 'Critical',
    aliases: ['transistor', 'amplification', 'semiconductor switch', 'bjt', 'mosfet', 'base collector emitter', 'gate source drain'],
    examples: ['mosfet switch', 'bipolar junction transistor amplifier'],
    misconceptions: ['transistors function without external power supplies', 'BJT and MOSFET have identical gate drive requirements']
  },
  diodes: {
    id: 'diodes',
    concept: 'Diodes',
    importance: 'Critical',
    aliases: ['diode', 'one way current', 'rectification', 'pn junction', 'forward bias', 'reverse bias', 'led'],
    examples: ['bridge rectifier', 'light emitting diode forward current'],
    misconceptions: ['diodes have zero voltage drop in forward bias', 'diodes block reverse current infinitely']
  },
  logic_gates: {
    id: 'logic_gates',
    concept: 'Logic Gates',
    importance: 'Critical',
    aliases: ['logic gates', 'and gate', 'or gate', 'not gate', 'xor gate', 'nand gate', 'nor gate', 'truth table', 'boolean logic'],
    examples: ['xor gate addition', 'nand gate universal'],
    misconceptions: ['nand gate is not universal', 'exclusive OR outputs true when all inputs are true']
  },
  // ═══════════════════════════════════════════════════════════════
  // DATABASE (6 new concepts)
  // ═══════════════════════════════════════════════════════════════
  sql: {
    id: 'sql',
    concept: 'SQL',
    importance: 'Critical',
    aliases: ['sql', 'structured query language', 'select query', 'database query', 'ddl', 'dml', 'relational query', 'query language'],
    examples: ['SELECT * FROM users WHERE id = 1', 'INSERT INTO table VALUES'],
    misconceptions: ['sql is a programming language for general purpose', 'sql only works with mysql']
  },
  primary_key: {
    id: 'primary_key',
    concept: 'Primary Key',
    importance: 'Critical',
    aliases: ['primary key', 'unique index', 'row identifier', 'table key', 'pk', 'not null unique'],
    examples: ['PRIMARY KEY (id)', 'id INTEGER NOT NULL UNIQUE'],
    misconceptions: ['primary key can have null values', 'a table can have multiple primary keys']
  },
  foreign_key: {
    id: 'foreign_key',
    concept: 'Foreign Key',
    importance: 'Critical',
    aliases: ['foreign key', 'referential integrity', 'reference key', 'fk', 'relationship key', 'table reference'],
    examples: ['FOREIGN KEY (user_id) REFERENCES users(id)'],
    misconceptions: ['foreign keys always create automatic indexes', 'foreign key must reference primary key only']
  },
  normalization: {
    id: 'normalization',
    concept: 'Normalization',
    importance: 'Important',
    aliases: ['normalization', 'normal form', '1nf', '2nf', '3nf', 'bcnf', 'reduce redundancy', 'denormalization', 'data redundancy', 'anomalies'],
    examples: ['1NF requires atomic values', '3NF removes transitive dependencies'],
    misconceptions: ['denormalization is always better', 'normalization eliminates all redundancy']
  },
  acid: {
    id: 'acid',
    concept: 'ACID Properties',
    importance: 'Critical',
    aliases: ['acid', 'atomicity', 'consistency', 'isolation', 'durability', 'transaction', 'rollback', 'commit', 'locking'],
    examples: ['ACID guarantees reliable transactions', 'Atomicity means all or nothing'],
    misconceptions: ['acid is only for sql databases', 'isolation means transactions cannot run concurrently']
  },
  database_indexing: {
    id: 'database_indexing',
    concept: 'Database Indexing',
    importance: 'Important',
    aliases: ['index', 'indexing', 'b-tree index', 'hash index', 'query optimization', 'scan', 'explain plan', 'index structure'],
    examples: ['B-tree index speeds up range queries', 'CREATE INDEX on column'],
    misconceptions: ['more indexes always improve performance', 'indexes have no storage overhead']
  },
  sql_nosql: {
    id: 'sql_nosql',
    concept: 'SQL vs NoSQL',
    importance: 'Important',
    aliases: ['sql vs nosql', 'relational vs non-relational', 'sql nosql difference', 'document store', 'key value store', 'tabular data', 'schemaless'],
    examples: ['SQL uses structured tables, NoSQL uses documents or key-value pairs'],
    misconceptions: ['nosql is always faster than sql', 'nosql databases do not support any queries']
  },
  // ═══════════════════════════════════════════════════════════════
  // OPERATING SYSTEMS (6 new concepts)
  // ═══════════════════════════════════════════════════════════════
  operating_system: {
    id: 'operating_system',
    concept: 'Operating System',
    importance: 'Critical',
    aliases: ['os', 'operating system', 'kernel', 'system software', 'resource manager', 'process manager', 'memory manager'],
    examples: ['linux kernel manages processes and memory', 'windows os allocates cpu time'],
    misconceptions: ['the os is just a user interface', 'operating system and kernel are identical']
  },
  process: {
    id: 'process',
    concept: 'Process',
    importance: 'Critical',
    aliases: ['process', 'program execution', 'running program', 'pcb', 'process control block', 'executing program'],
    examples: ['process is an active program in execution', 'each process has its own memory space'],
    misconceptions: ['process and thread are the same thing', 'processes share memory by default']
  },
  thread: {
    id: 'thread',
    concept: 'Thread',
    importance: 'Critical',
    aliases: ['thread', 'lightweight process', 'multithreading', 'concurrent execution', 'parallel execution', 'worker thread'],
    examples: ['threads share the same memory space', 'multithreading allows concurrent operations'],
    misconceptions: ['threads always run in parallel', 'threads do not share memory']
  },
  deadlock: {
    id: 'deadlock',
    concept: 'Deadlock',
    importance: 'Critical',
    aliases: ['deadlock', 'mutual exclusion', 'hold and wait', 'circular wait', 'no preemption', 'resource allocation graph', 'race condition'],
    examples: ['four conditions must hold for deadlock', 'preventing one condition prevents deadlock'],
    misconceptions: ['deadlock and starvation are the same', 'adding more resources fixes deadlock']
  },
  scheduling: {
    id: 'scheduling',
    concept: 'Process Scheduling',
    importance: 'Important',
    aliases: ['scheduling', 'cpu scheduling', 'fcfs', 'round robin', 'sjf', 'shortest job first', 'preemptive', 'non-preemptive', 'context switch', 'dispatcher'],
    examples: ['round robin gives each process a time slice', 'sjf minimizes average waiting time'],
    misconceptions: ['fcfs is always the worst algorithm', 'round robin is always fair']
  },
  virtual_memory: {
    id: 'virtual_memory',
    concept: 'Virtual Memory',
    importance: 'Important',
    aliases: ['virtual memory', 'paging', 'page fault', 'swap', 'mmu', 'tlb', 'segmentation', 'page table', 'memory management unit'],
    examples: ['virtual memory allows programs to use more RAM than available', 'page fault triggers disk read'],
    misconceptions: ['virtual memory is the same as physical ram', 'paging eliminates all fragmentation']
  },
  // ═══════════════════════════════════════════════════════════════
  // ALGORITHMS & DSA (7 new concepts)
  // ═══════════════════════════════════════════════════════════════
  time_complexity: {
    id: 'time_complexity',
    concept: 'Time Complexity',
    importance: 'Critical',
    aliases: ['time complexity', 'big o', 'o of n', 'big o notation', 'asymptotic', 'runtime analysis', 'upper bound', 'lower bound', 'omega', 'theta', 'o(1)', 'o(n)', 'o(log n)', 'o(n^2)'],
    examples: ['binary search is o(log n)', 'bubble sort is o(n squared)'],
    misconceptions: ['big o measures exact execution time', 'o(n) is always faster than o(n log n)']
  },
  recursion: {
    id: 'recursion',
    concept: 'Recursion',
    importance: 'Critical',
    aliases: ['recursion', 'recursive', 'base case', 'stack overflow', 'self-calling', 'recursive function', 'recurrence'],
    examples: ['factorial uses recursion with base case 0', 'fibonacci can be recursive'],
    misconceptions: ['recursion is always slower than iteration', 'every recursive function needs a base case only at the end']
  },
  dynamic_programming: {
    id: 'dynamic_programming',
    concept: 'Dynamic Programming',
    importance: 'Important',
    aliases: ['dynamic programming', 'dp', 'memoization', 'tabulation', 'overlapping subproblems', 'optimal substructure', 'top down', 'bottom up'],
    examples: ['memoization stores previously computed results', 'knapsack problem uses dynamic programming'],
    misconceptions: ['dp is just recursion with caching', 'dp always uses more memory than recursion']
  },
  tree: {
    id: 'tree',
    concept: 'Tree Data Structure',
    importance: 'Critical',
    aliases: ['tree', 'binary tree', 'bst', 'binary search tree', 'root', 'leaf', 'node', 'parent child', 'hierarchical', 'balanced tree', 'avl tree', 'b-tree'],
    examples: ['binary search tree keeps data sorted', 'bst allows o(log n) search'],
    misconceptions: ['bst always maintains balanced structure', 'trees are linear data structures']
  },
  graph: {
    id: 'graph',
    concept: 'Graph Data Structure',
    importance: 'Critical',
    aliases: ['graph', 'vertex', 'vertices', 'edge', 'adjacency', 'adjacency matrix', 'adjacency list', 'directed graph', 'undirected graph', 'weighted graph', 'bfs', 'dfs', 'breadth first', 'depth first'],
    examples: ['bfs explores level by level using a queue', 'dfs explores deeply using a stack'],
    misconceptions: ['graphs and trees are the same', 'bfs and dfs always visit the same nodes']
  },
  hash_table: {
    id: 'hash_table',
    concept: 'Hash Table',
    importance: 'Critical',
    aliases: ['hash table', 'hash map', 'dictionary', 'collision', 'chaining', 'open addressing', 'hash function', 'hashing', 'bucket'],
    examples: ['hash table provides average o(1) lookup', 'chaining resolves collisions using linked lists'],
    misconceptions: ['hash table guarantees o(1) in all cases', 'hash collisions are always handled by chaining']
  },
  binary_search: {
    id: 'binary_search',
    concept: 'Binary Search',
    importance: 'Important',
    aliases: ['binary search', 'divide and conquer', 'log n search', 'sorted array search', 'halving', 'midpoint comparison'],
    examples: ['binary search requires sorted array', 'eliminates half the remaining elements each step'],
    misconceptions: ['binary search works on unsorted arrays', 'binary search is o(n)']
  },
  // ═════════════════════════════���═════════════════════════════════
  // NETWORKING & SECURITY (8 new concepts)
  // ═══════════════════════════════════════════════════════════════
  http: {
    id: 'http',
    concept: 'HTTP and HTTPS',
    importance: 'Critical',
    aliases: ['http', 'https', 'hypertext transfer protocol', 'ssl', 'tls', 'port 80', 'port 443', 'stateless', 'request response', 'http methods'],
    examples: ['http is stateless and uses port 80', 'https encrypts communication via tls'],
    misconceptions: ['http is stateful', 'https only encrypts the body not the headers']
  },
  dns: {
    id: 'dns',
    concept: 'DNS',
    importance: 'Important',
    aliases: ['dns', 'domain name system', 'name resolution', 'ip lookup', 'domain to ip', 'dns resolver', 'nameserver', 'dns record'],
    examples: ['dns translates domain names to ip addresses', 'dns uses hierarchical distributed database'],
    misconceptions: ['dns always returns the same ip', 'dns queries are always unencrypted']
  },
  rest_api: {
    id: 'rest_api',
    concept: 'REST API',
    importance: 'Critical',
    aliases: ['rest', 'restful', 'rest api', 'get', 'post', 'put', 'delete', 'stateless', 'endpoint', 'crud', 'resource url', 'http methods', 'api'],
    examples: ['restful api uses http methods for crud', 'rest is stateless'],
    misconceptions: ['rest requires soap', 'restful apis must use json only']
  },
  jwt: {
    id: 'jwt',
    concept: 'JWT',
    importance: 'Critical',
    aliases: ['jwt', 'json web token', 'token', 'claims', 'signature', 'bearer token', 'access token', 'refresh token', 'stateless authentication'],
    examples: ['jwt contains header payload and signature', 'jwt is stateless and self-contained'],
    misconceptions: ['jwt is encrypted by default', 'jwt tokens never expire']
  },
  authentication: {
    id: 'authentication',
    concept: 'Authentication and Authorization',
    importance: 'Critical',
    aliases: ['authentication', 'authorization', 'auth', 'login', 'verify identity', 'access control', 'credentials', 'oauth', 'session', 'cookie', 'sso', '401', '403'],
    examples: ['authentication verifies who you are', 'authorization determines what you can access'],
    misconceptions: ['authentication and authorization are the same thing', 'oauth is an authentication protocol']
  },
  load_balancing: {
    id: 'load_balancing',
    concept: 'Load Balancing',
    importance: 'Important',
    aliases: ['load balancer', 'load balancing', 'traffic distribution', 'round robin', 'least connections', 'health check', 'high availability', 'layer 4', 'layer 7'],
    examples: ['round robin distributes requests evenly', 'least connections routes to the least busy server'],
    misconceptions: ['load balancing only works for http', 'round robin is always the best strategy']
  },
  caching: {
    id: 'caching',
    concept: 'Caching',
    importance: 'Important',
    aliases: ['cache', 'caching', 'redis', 'memcached', 'lru', 'ttl', 'eviction', 'cache hit', 'cache miss', 'cache stampede'],
    examples: ['redis is an in-memory cache', 'lru evicts the least recently used entry'],
    misconceptions: ['caching eliminates all latency', 'cache always has the latest data']
  },
  containerization: {
    id: 'containerization',
    concept: 'Containerization',
    importance: 'Important',
    aliases: ['container', 'docker', 'containerization', 'image', 'dockerfile', 'virtual machine', 'isolation', 'microservices', 'kubernetes', 'k8s', 'deployment'],
    examples: ['docker containers share the host kernel', 'containers are lighter than virtual machines'],
    misconceptions: ['containers are virtual machines', 'docker is the only container tool']
  },
  // ═════════════════════════════════════════════════════════��═════
  // CLOUD & DEVOPS (4 new concepts)
  // ═══════════════════════════════════════════════════════��═══════
  cloud_computing: {
    id: 'cloud_computing',
    concept: 'Cloud Computing',
    importance: 'Important',
    aliases: ['cloud', 'cloud computing', 'iaas', 'paas', 'saas', 'virtual machine', 'elastic', 'on demand', 'serverless', 'aws', 'azure', 'gcp'],
    examples: ['iaas provides virtual machines', 'saas provides software over the internet'],
    misconceptions: ['cloud computing is just hosting on a remote server', 'cloud is always cheaper than on-premise']
  },
  cicd: {
    id: 'cicd',
    concept: 'CI/CD',
    importance: 'Important',
    aliases: ['ci cd', 'continuous integration', 'continuous deployment', 'continuous delivery', 'pipeline', 'automated testing', 'build pipeline', 'deploy pipeline'],
    examples: ['ci runs automated tests on every commit', 'cd automatically deploys to production after passing tests'],
    misconceptions: ['ci and cd are the same thing', 'ci cd eliminates the need for manual testing']
  },
  monitoring: {
    id: 'monitoring',
    concept: 'System Monitoring',
    importance: 'NiceToHave',
    aliases: ['monitoring', 'observability', 'logging', 'metrics', 'tracing', 'apm', 'uptime', 'alerting', 'dashboards'],
    examples: ['apm tools track response times', 'monitoring dashboards show system health'],
    misconceptions: ['monitoring only means checking uptime', 'logs are the only form of monitoring']
  },
  microservices: {
    id: 'microservices',
    concept: 'Microservices Architecture',
    importance: 'Important',
    aliases: ['microservices', 'microservice', 'service oriented', 'api gateway', 'bounded context', 'distributed system', 'eventual consistency', 'saga pattern'],
    examples: ['microservices are independently deployable', 'api gateway routes requests to services'],
    misconceptions: ['microservices are always better than monolith', 'microservices eliminate all complexity']
  },
  // ═══════════════════════════════════════════════════════════════
  // ECE — CIRCUITS (6 new concepts)
  // ═══════════════════════════════════════════════════════════════
  voltage: {
    id: 'voltage',
    concept: 'Voltage',
    importance: 'Critical',
    aliases: ['voltage', 'potential difference', 'emf', 'electromotive force', 'electric potential', 'volts'],
    examples: ['voltage is the potential difference between two points', 'emf drives current through a circuit'],
    misconceptions: ['voltage and current are the same', 'voltage is consumed by components']
  },
  current: {
    id: 'current',
    concept: 'Current',
    importance: 'Critical',
    aliases: ['current', 'electric current', 'amperes', 'amps', 'electron flow', 'charge flow', 'current flow'],
    examples: ['current is the flow rate of electric charge in coulombs per second', 'drift velocity of charge carriers'],
    misconceptions: ['current flows from negative to positive in conventional notation', 'current is consumed by components']
  },
  resistance: {
    id: 'resistance',
    concept: 'Resistance',
    importance: 'Critical',
    aliases: ['resistance', 'resistor', 'resistivity', 'ohm', 'impedance', 'opposition', 'current limiting', 'voltage drop'],
    examples: ['resistance opposes current flow', 'resistivity depends on material properties'],
    misconceptions: ['resistance always converts to heat', 'resistance and impedance are identical']
  },
  power_electrical: {
    id: 'power_electrical',
    concept: 'Electrical Power',
    importance: 'Important',
    aliases: ['power', 'watts', 'p equals vi', 'energy dissipation', 'joules', 'watt', 'power dissipation'],
    examples: ['power equals voltage times current', 'p = vi = i squared r'],
    misconceptions: ['power is the same as energy', 'higher voltage always means higher power']
  },
  inductor: {
    id: 'inductor',
    concept: 'Inductor',
    importance: 'Critical',
    aliases: ['inductor', 'inductance', 'magnetic field', 'choke', 'coil', 'energy storage', 'henry', 'impedance'],
    examples: ['inductor stores energy in magnetic field', 'inductors oppose changes in current'],
    misconceptions: ['inductors block dc and ac equally', 'inductors are just coiled wires with no function']
  },
  opamp: {
    id: 'opamp',
    concept: 'Operational Amplifier',
    importance: 'Important',
    aliases: ['op-amp', 'operational amplifier', 'opamp', 'inverting amplifier', 'non-inverting amplifier', 'virtual ground', 'feedback', 'differential amplifier', 'high gain'],
    examples: ['op-amp has very high open-loop gain', 'inverting amplifier uses negative feedback'],
    misconceptions: ['op-amp can amplify dc signals with no power supply', 'virtual ground means zero volts']
  },
  // ═══════════════════════════════════════════════════════════════
  // ECE — SIGNALS & COMMUNICATION (8 new concepts)
  // ═══════════════════════════════════════════════════════════════
  frequency: {
    id: 'frequency',
    concept: 'Frequency',
    importance: 'Critical',
    aliases: ['frequency', 'hertz', 'hz', 'cycles per second', 'time period', 'f = 1/t', 'angular frequency', 'spectrum'],
    examples: ['frequency is cycles per second in hertz', 'frequency is inverse of time period'],
    misconceptions: ['higher frequency always means better signal', 'frequency and wavelength are unrelated']
  },
  wavelength: {
    id: 'wavelength',
    concept: 'Wavelength',
    importance: 'Important',
    aliases: ['wavelength', 'lambda', 'wave length', 'distance between peaks', 'spatial period'],
    examples: ['wavelength equals speed of light divided by frequency', 'c = f lambda'],
    misconceptions: ['wavelength increases with frequency', 'wavelength is the same as amplitude']
  },
  amplitude: {
    id: 'amplitude',
    concept: 'Amplitude',
    importance: 'Important',
    aliases: ['amplitude', 'peak amplitude', 'peak height', 'signal strength', 'magnitude', 'wave height'],
    examples: ['amplitude is the maximum displacement from zero', 'power is proportional to amplitude squared'],
    misconceptions: ['amplitude and frequency are the same', 'amplitude never changes during transmission']
  },
  modulation: {
    id: 'modulation',
    concept: 'Modulation',
    importance: 'Critical',
    aliases: ['modulation', 'am modulation', 'fm modulation', 'amplitude modulation', 'frequency modulation', 'carrier wave', 'sideband', 'modulation index', 'envelope detector'],
    examples: ['am varies carrier amplitude', 'fm has better noise immunity than am'],
    misconceptions: ['am and fm use the same bandwidth', 'modulation is only for analog signals']
  },
  bandwidth: {
    id: 'bandwidth',
    concept: 'Bandwidth',
    importance: 'Important',
    aliases: ['bandwidth', 'frequency range', 'channel capacity', 'shannon capacity', 'data rate', 'signal bandwidth'],
    examples: ['bandwidth determines maximum data rate', 'shannon-hartley theorem relates bandwidth to capacity'],
    misconceptions: ['bandwidth and speed are the same', 'bandwidth is only about internet speed']
  },
  snr: {
    id: 'snr',
    concept: 'Signal-to-Noise Ratio',
    importance: 'Important',
    aliases: ['signal to noise ratio', 'snr', 'noise ratio', 'signal quality', 'db ratio', 'decibel'],
    examples: ['higher snr means better signal quality', 'snr is measured in decibels'],
    misconceptions: ['snr only applies to audio', 'higher snr means more noise']
  },
  multiplexing: {
    id: 'multiplexing',
    concept: 'Multiplexing',
    importance: 'Important',
    aliases: ['multiplexing', 'mux', 'tdm', 'fdm', 'time division multiplexing', 'frequency division multiplexing', 'channel sharing', 'guard band', 'demultiplexing'],
    examples: ['tdm shares channel by time slots', 'fdm shares channel by frequency bands'],
    misconceptions: ['tdm and fdm are identical', 'multiplexing increases total bandwidth']
  },
  adc_dac: {
    id: 'adc_dac',
    concept: 'ADC and DAC',
    importance: 'Important',
    aliases: ['adc', 'dac', 'analog to digital converter', 'digital to analog converter', 'sampling', 'quantization', 'nyquist', 'nyquist theorem', 'conversion resolution'],
    examples: ['adc converts analog to digital by sampling', 'nyquist theorem requires sampling at twice the highest frequency'],
    misconceptions: ['adc produces a perfect digital copy', 'higher bit resolution means higher sampling rate']
  },
  // ═══════════════════════════════════════════════════════════════
  // ECE — DIGITAL SYSTEMS & EMBEDDED (6 new concepts)
  // ═══════════════════════════════════════════════════════════════
  microprocessor: {
    id: 'microprocessor',
    concept: 'Microprocessor',
    importance: 'Important',
    aliases: ['microprocessor', 'cpu', 'processor', 'central processing unit', 'instruction set', 'clock speed', 'registers'],
    examples: ['microprocessor is a cpu on a single chip', 'microprocessor requires external memory and io'],
    misconceptions: ['microprocessor and microcontroller are the same', 'higher clock speed always means better performance']
  },
  microcontroller: {
    id: 'microcontroller',
    concept: 'Microcontroller',
    importance: 'Important',
    aliases: ['microcontroller', 'mcu', 'embedded processor', 'arm cortex', 'avr', 'pic', 'stm32', 'esp32', 'arduino'],
    examples: ['microcontroller has cpu ram rom and io on one chip', 'mcus are used in dedicated control applications'],
    misconceptions: ['microcontrollers are just small computers', 'microcontrollers cannot run operating systems']
  },
  flip_flop: {
    id: 'flip_flop',
    concept: 'Flip-Flop',
    importance: 'Important',
    aliases: ['flip flop', 'sr flip flop', 'jk flip flop', 'd flip flop', 't flip flop', 'edge triggered', 'clock pulse', 'memory element', 'sequential circuit'],
    examples: ['d flip flop stores one bit of data', 'jk flip flop toggles on clock pulse'],
    misconceptions: ['flip flops are combinational logic', 'all flip flops work the same way']
  },
  register: {
    id: 'register',
    concept: 'Register',
    importance: 'NiceToHave',
    aliases: ['register', 'shift register', 'parallel register', 'serial register', 'data register', 'cpu register', 'accumulator'],
    examples: ['shift register moves bits through stages', 'registers are fastest memory in cpu'],
    misconceptions: ['registers are the same as ram', 'registers store data permanently']
  },
  counter: {
    id: 'counter',
    concept: 'Counter',
    importance: 'NiceToHave',
    aliases: ['counter', 'ripple counter', 'synchronous counter', 'asynchronous counter', 'mod counter', 'binary counter', 'down counter', 'up counter'],
    examples: ['ripple counter is asynchronous', 'synchronous counter uses a common clock'],
    misconceptions: ['counters are always synchronous', 'ripple counters are faster than synchronous']
  },
  embedded_systems: {
    id: 'embedded_systems',
    concept: 'Embedded Systems',
    importance: 'Important',
    aliases: ['embedded', 'embedded system', 'rtos', 'real time', 'bare metal', 'gpio', 'uart', 'spi', 'i2c', 'pwm', 'adc embedded', 'interrupt', 'timer', 'mqtt', 'bluetooth'],
    examples: ['embedded system runs on dedicated hardware', 'gpio controls pins for input output'],
    misconceptions: ['embedded systems always run linux', 'embedded systems do not need real time constraints']
  },
  // ═══════════════════════════════════════════════════════════════
  // BEHAVIORAL, SITUATIONAL, SCENARIO & HR CONCEPTS
  // ═══════════════════════════════════════════════════════════════
  star_framework: {
    id: 'star_framework',
    concept: 'STAR Framework',
    importance: 'Critical',
    aliases: ['star method', 'star framework', 'situation task action result', 'structured story', 'behavioral structure', 'past scenario', 'specific situation', 'action taken', 'measurable result'],
    examples: ['situation task action result', 'in my previous role the situation was'],
    misconceptions: ['behavioral answers only need a generic summary', 'star method requires hardcoded textbook headings']
  },
  personal_ownership: {
    id: 'personal_ownership',
    concept: 'Personal Ownership',
    importance: 'Critical',
    aliases: ['personal ownership', 'individual contribution', 'personally implemented', 'implemented the', 'led the effort', 'i led', 'i implemented', 'i designed', 'my role', 'my responsibility', 'my individual action', 'i took ownership', 'my contribution'],
    examples: ['i personally implemented the module', 'my direct responsibility was leading the triage'],
    misconceptions: ['using we instead of i is sufficient to show individual technical contribution', 'ownership means taking credit for others']
  },
  conflict_resolution: {
    id: 'conflict_resolution',
    concept: 'Conflict Resolution',
    importance: 'Important',
    aliases: ['conflict resolution', 'disagreement', 'stakeholder alignment', 'differing technical opinions', 'active listening', 'technical alignment', 'reaching consensus', 'compromise', 'cross functional collaboration'],
    examples: ['we aligned on a shared architectural compromise', 'listened to team feedback and resolved the disagreement'],
    misconceptions: ['conflict resolution means always giving in to others', 'disagreements are bad and should be avoided']
  },
  adaptability: {
    id: 'adaptability',
    concept: 'Adaptability',
    importance: 'Important',
    aliases: ['adaptability', 'pivoting', 'changing requirements', 'handling ambiguity', 'priority shift', 'resilience', 'fast learning', 'adapting to change', 'flexible approach'],
    examples: ['pivoted to a new database engine when requirements shifted', 'adapted my implementation strategy under tight deadlines'],
    misconceptions: ['adaptability means ignoring initial project architecture', 'being flexible means having no structured plan']
  },
  leadership: {
    id: 'leadership',
    concept: 'Leadership & Mentorship',
    importance: 'Important',
    aliases: ['leadership', 'mentorship', 'guiding junior engineers', 'driving initiative', 'project ownership', 'technical leadership', 'setting standards', 'fostering growth'],
    examples: ['mentored junior developers on design patterns', 'took technical leadership to drive the refactoring project'],
    misconceptions: ['leadership is only for designated managers', 'leadership means making all decisions unilaterally']
  },
  incident_triage: {
    id: 'incident_triage',
    concept: 'Incident Triage & Response',
    importance: 'Critical',
    aliases: ['incident response', 'triage', 'production outage', 'root cause analysis', 'rca', 'post mortem', 'severity assessment', 'diagnostic steps', 'system logs'],
    examples: ['triaged production outage by analyzing server logs', 'conducted post-mortem to prevent recurring incident'],
    misconceptions: ['triage is just restarting the server', 'post-mortems are meant for assigning personal blame']
  },
  risk_mitigation: {
    id: 'risk_mitigation',
    concept: 'Risk Mitigation & Safeguards',
    importance: 'Critical',
    aliases: ['risk mitigation', 'rollback plan', 'feature flags', 'fallback strategy', 'circuit breaker', 'graceful degradation', 'safeguards', 'canary deployment'],
    examples: ['implemented feature flags to enable safe rollback', 'added circuit breaker to prevent cascading failures'],
    misconceptions: ['testing in staging removes the need for rollback plans', 'feature flags increase system risk']
  },
  stakeholder_communication: {
    id: 'stakeholder_communication',
    concept: 'Stakeholder Communication',
    importance: 'Important',
    aliases: ['stakeholder communication', 'status updates', 'escalation path', 'clear expectations', 'cross functional communication', 'non technical summary', 'incident updates'],
    examples: ['communicated incident status to non-technical stakeholders', 'provided clear ETA and mitigation updates'],
    misconceptions: ['stakeholders need full raw code details', 'hiding delays is better than transparent status updates']
  },
  self_introduction: {
    id: 'self_introduction',
    concept: 'Self Introduction',
    importance: 'Critical',
    aliases: ['self introduction', 'professional background', 'career overview', 'key achievements', 'technical domain expertise', 'work experience', 'relevant background', 'career journey'],
    examples: ['i have 3 years of experience in backend development', 'my primary focus is building scalable microservices'],
    misconceptions: ['self-introductions should recite the entire resume line-by-line', 'personal background needs no technical highlights']
  },
  concise_articulation: {
    id: 'concise_articulation',
    concept: 'Concise & Structured Articulation',
    importance: 'Important',
    aliases: ['concise articulation', 'clear delivery', 'structured summary', 'logical progression', 'direct answers', 'articulate response', 'well structured explanation'],
    examples: ['articulated the architecture concisely using three core pillars', 'gave a direct structured answer'],
    misconceptions: ['longer answers are always better answers', 'talking continuously shows higher technical knowledge']
  }
};
