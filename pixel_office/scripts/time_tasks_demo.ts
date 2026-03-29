// Time + Tasks demo script for Pixel Office
// Run this to sanity-check events, tasks_v2, sessions, and derived views.

import { events, tasksV2, sessions, generateTodaysPlan, generateTodaysLog, suggestEveningMicroSprint } from '../src/pixel_memory';

async function main() {
  console.log('--- Time + Tasks Demo Start ---');

  const now = new Date();

  // 1. Create sample event for today
  const event = await events.create({
    title: 'Pixel Office testing block',
    type: 'work',
    start_time: now,
    end_time: new Date(now.getTime() + 60 * 60 * 1000), // +1h
    source: 'manual',
    notes: 'Testing Time + Tasks integration demo',
  });
  console.log('Created event:', event);

  // 2. Create a sample task
  const task = await tasksV2.create({
    title: 'Demo: wire Time + Tasks UI',
    description: 'Use this task to validate tasks_v2 + sessions + views.',
    status: 'ready',
    priority: 'P1',
    timebox: '45m',
    tags: ['work', 'pixel-office'],
    source: 'manual',
  });
  console.log('Created task:', task);

  // 3. Start and end a session for the task
  const session = await sessions.start({ task_id: task.id });
  console.log('Started session:', session);

  // Simulate some work duration (no actual delay to keep script fast)
  const ended = await sessions.end(session.id, {
    notes: 'Completed demo session for Time + Tasks.',
  });
  console.log('Ended session:', ended);

  // 4. Generate derived views
  const plan = await generateTodaysPlan();
  console.log('\n--- Today\'s Plan ---');
  console.dir(plan, { depth: null });

  const log = await generateTodaysLog();
  console.log('\n--- Today\'s Log ---');
  console.dir(log, { depth: null });

  const sprint = await suggestEveningMicroSprint();
  console.log('\n--- Evening Micro-Sprint Suggestion ---');
  console.dir(sprint, { depth: null });

  console.log('\n--- Time + Tasks Demo End ---');
}

main().catch((err) => {
  console.error('Time + Tasks demo failed:', err);
  process.exit(1);
});
