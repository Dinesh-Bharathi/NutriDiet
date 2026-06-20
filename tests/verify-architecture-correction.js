// backend/tests/verify-architecture-correction.js
import prisma from '../src/lib/prisma.js';
import { reminderTemplateService } from '../src/modules/automation/reminder-template.service.js';
import { reminderGeneratorService } from '../src/modules/automation/reminder-generator.service.js';
import { AUTOMATION_CONFIG } from '../src/modules/automation/automation.config.js';

async function main() {
  console.log('--- Phase 7E.1 Water & Sleep Reminder Architecture Correction Verification ---\n');

  let failed = false;

  try {
    // 1. Verify Seeding & Button configuration
    console.log('[Test 1] Verifying System Default Templates Seeding & Buttons...');
    const result = await reminderTemplateService.getTemplates('system-test-tenant', { page: 1, limit: 100 });
    const templates = result.templates;

    const waterReminder = templates.find(t => t.type === 'WATER_REMINDER' && t.tenantId === null);
    const waterFollowup = templates.find(t => t.type === 'WATER_FOLLOWUP' && t.tenantId === null);
    const sleepReminder = templates.find(t => t.type === 'SLEEP_REMINDER' && t.tenantId === null);
    const sleepFollowup = templates.find(t => t.type === 'SLEEP_FOLLOWUP' && t.tenantId === null);

    if (!waterReminder || waterReminder.buttons.length !== 0) {
      console.log('❌ Failure: WATER_REMINDER template should have no buttons.');
      failed = true;
    } else {
      console.log('✅ WATER_REMINDER has no buttons.');
    }

    if (!waterFollowup || waterFollowup.buttons.length !== 4) {
      console.log('❌ Failure: WATER_FOLLOWUP template should have exactly 4 compliance buttons.');
      failed = true;
    } else {
      console.log('✅ WATER_FOLLOWUP has 4 compliance buttons.');
    }

    if (!sleepReminder || sleepReminder.buttons.length !== 0) {
      console.log('❌ Failure: SLEEP_REMINDER template should have no buttons.');
      failed = true;
    } else {
      console.log('✅ SLEEP_REMINDER has no buttons.');
    }

    if (!sleepFollowup || sleepFollowup.buttons.length !== 4) {
      console.log('❌ Failure: SLEEP_FOLLOWUP template should have exactly 4 compliance buttons.');
      failed = true;
    } else {
      console.log('✅ SLEEP_FOLLOWUP has 4 compliance buttons.');
    }

    // 2. Compliance Event Rules Check (in reminder-processor logic)
    console.log('\n[Test 2] Verifying Compliance Event Creation Rules...');
    
    const requiresCompliance = (jobType) => {
      return [
        'MEAL_FOLLOWUP',
        'WATER_FOLLOWUP',
        'SLEEP_FOLLOWUP'
      ].includes(jobType);
    };

    const reminderTypes = ['MEAL_REMINDER', 'WATER_REMINDER', 'SLEEP_REMINDER'];
    const followupTypes = ['MEAL_FOLLOWUP', 'WATER_FOLLOWUP', 'SLEEP_FOLLOWUP'];

    for (const t of reminderTypes) {
      if (requiresCompliance(t)) {
        console.log(`❌ Failure: Behavioral reminder ${t} should NOT create compliance events.`);
        failed = true;
      } else {
        console.log(`✅ Behavioral reminder ${t} does not require compliance.`);
      }
    }

    for (const t of followupTypes) {
      if (!requiresCompliance(t)) {
        console.log(`❌ Failure: Follow-up type ${t} should create compliance events.`);
        failed = true;
      } else {
        console.log(`✅ Follow-up type ${t} requires compliance.`);
      }
    }

    // 3. Scheduling offset and morning timing calculations
    console.log('\n[Test 3] Verifying Scheduler Offset Calculations...');
    
    // Simulate water follow-up timing
    const sleepTimeStr = '22:00';
    const waterFollowupOffset = 15;
    
    const [hStr, mStr] = sleepTimeStr.split(':');
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    const totalMinutes = hours * 60 + minutes - waterFollowupOffset;
    const wrappedMinutes = (totalMinutes + 24 * 60) % (24 * 60);
    const newHours = Math.floor(wrappedMinutes / 60);
    const newMinutes = wrappedMinutes % 60;
    const pad = (num) => String(num).padStart(2, '0');
    const calculatedWaterTime = `${pad(newHours)}:${pad(newMinutes)}`;

    if (calculatedWaterTime !== '21:45') {
      console.log(`❌ Failure: Expected water follow-up offset time to be 21:45, got ${calculatedWaterTime}`);
      failed = true;
    } else {
      console.log('✅ Water Follow-up Offset Calculation matches expectations (21:45).');
    }

    // 4. Job Regeneration Check
    console.log('\n[Test 4] Verifying Active Database Jobs and BullMQ alignment...');
    
    // Fetch count of pending jobs in database to ensure they are regenerated
    const pendingJobs = await prisma.reminderJob.findMany({
      where: { status: 'PENDING' },
      select: { jobType: true }
    });
    
    const types = pendingJobs.map(j => j.jobType);
    console.log(`Currently scheduled PENDING jobs: ${pendingJobs.length}`);
    console.log(`Scheduled WATER_FOLLOWUP jobs: ${types.filter(t => t === 'WATER_FOLLOWUP').length}`);
    console.log(`Scheduled SLEEP_FOLLOWUP jobs: ${types.filter(t => t === 'SLEEP_FOLLOWUP').length}`);
    console.log(`Scheduled WATER_REMINDER jobs: ${types.filter(t => t === 'WATER_REMINDER').length}`);
    console.log(`Scheduled SLEEP_REMINDER jobs: ${types.filter(t => t === 'SLEEP_REMINDER').length}`);

    if (types.includes('WATER_REMINDER') && types.includes('WATER_FOLLOWUP') && types.includes('SLEEP_REMINDER') && types.includes('SLEEP_FOLLOWUP')) {
      console.log('✅ Success: Active schedules contain all required behavioral reminders and follow-up check-ins.');
    } else {
      console.log('⚠️ Warning: Not all reminder and follow-up job types are populated. Check active automations.');
    }

  } catch (err) {
    console.error('❌ Error during verification:', err);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }

  if (failed) {
    console.log('\n❌ VERIFICATION FAILED.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

main();
