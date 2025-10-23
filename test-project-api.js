/**
 * Test Script for Project API
 * 
 * This script tests all project API endpoints to ensure they're working correctly.
 * 
 * Usage:
 * 1. Start your backend server
 * 2. Update the EMAIL and PASSWORD below with valid credentials
 * 3. Run: node test-project-api.js
 */

const BASE_URL = 'http://localhost:3000/api/v1';

// UPDATE THESE WITH YOUR TEST USER CREDENTIALS
const EMAIL = 'test@example.com';
const PASSWORD = 'password123';

let token = '';
let projectId = '';

// Helper function to make requests
async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token && !options.skipAuth) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        const data = await response.json();

        console.log(`\n${options.method || 'GET'} ${endpoint}`);
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        return data;
    } catch (error) {
        console.error(`\nError ${options.method || 'GET'} ${endpoint}:`, error.message);
        throw error;
    }
}

// Test functions
async function testLogin() {
    console.log('\n=== TEST 1: Login ===');
    const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: EMAIL,
            password: PASSWORD,
        }),
        skipAuth: true,
    });

    if (data.status && data.data.token) {
        token = data.data.token;
        console.log('✅ Login successful, token received');
        return true;
    } else {
        console.log('❌ Login failed');
        return false;
    }
}

async function testCreateProject() {
    console.log('\n=== TEST 2: Create Project ===');
    const data = await request('/projects', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Test Project',
            description: 'Testing project API',
            tags: ['test', 'api'],
        }),
    });

    if (data.status && data.data.project) {
        projectId = data.data.project._id;
        console.log('✅ Project created, ID:', projectId);
        return true;
    } else {
        console.log('❌ Failed to create project');
        return false;
    }
}

async function testListProjects() {
    console.log('\n=== TEST 3: List Projects ===');
    const data = await request('/projects?limit=10');

    if (data.status && Array.isArray(data.data.projects)) {
        console.log(`✅ Found ${data.data.projects.length} projects`);
        return true;
    } else {
        console.log('❌ Failed to list projects');
        return false;
    }
}

async function testGetProject() {
    console.log('\n=== TEST 4: Get Project ===');
    const data = await request(`/projects/${projectId}`);

    if (data.status && data.data.project) {
        console.log('✅ Project retrieved successfully');
        return true;
    } else {
        console.log('❌ Failed to get project');
        return false;
    }
}

async function testUpdateProject() {
    console.log('\n=== TEST 5: Update Project ===');
    const data = await request(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: 'Updated Test Project',
            isFavorite: true,
        }),
    });

    if (data.status && data.data.project) {
        console.log('✅ Project updated successfully');
        return true;
    } else {
        console.log('❌ Failed to update project');
        return false;
    }
}

async function testAddNode() {
    console.log('\n=== TEST 6: Add Chat Node ===');
    const data = await request(`/projects/${projectId}/canvas/node`, {
        method: 'PUT',
        body: JSON.stringify({
            nodeId: 'test-node-1',
            x: 100,
            y: 200,
            width: 400,
            height: 500,
            prompt: 'What is artificial intelligence?',
            response: 'AI is...',
            model: 'gpt-4',
            status: 'success',
            tokens: {
                prompt: 10,
                completion: 50,
                total: 60,
            },
        }),
    });

    if (data.status && data.data.project) {
        console.log('✅ Node added successfully');
        return true;
    } else {
        console.log('❌ Failed to add node');
        return false;
    }
}

async function testUpdateCanvas() {
    console.log('\n=== TEST 7: Update Canvas ===');
    const data = await request(`/projects/${projectId}/canvas`, {
        method: 'PUT',
        body: JSON.stringify({
            zoom: 1.2,
            panX: 50,
            panY: 100,
        }),
    });

    if (data.status && data.data.project) {
        console.log('✅ Canvas updated successfully');
        return true;
    } else {
        console.log('❌ Failed to update canvas');
        return false;
    }
}

async function testAddChatMessage() {
    console.log('\n=== TEST 8: Add Chat Message ===');
    const data = await request(`/projects/${projectId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
            role: 'user',
            content: 'What is AI?',
            nodeId: 'test-node-1',
            model: 'gpt-4',
            tokens: {
                prompt: 10,
                completion: 0,
                total: 10,
            },
        }),
    });

    if (data.status && data.data.message) {
        console.log('✅ Message added successfully');
        return true;
    } else {
        console.log('❌ Failed to add message');
        return false;
    }
}

async function testGetChatHistory() {
    console.log('\n=== TEST 9: Get Chat History ===');
    const data = await request(`/projects/${projectId}/chat`);

    if (data.status && Array.isArray(data.data.chatHistory)) {
        console.log(`✅ Retrieved ${data.data.chatHistory.length} messages`);
        return true;
    } else {
        console.log('❌ Failed to get chat history');
        return false;
    }
}

async function testDuplicateProject() {
    console.log('\n=== TEST 10: Duplicate Project ===');
    const data = await request(`/projects/${projectId}/duplicate`, {
        method: 'POST',
    });

    if (data.status && data.data.project) {
        console.log('✅ Project duplicated successfully');
        console.log('Duplicate ID:', data.data.project._id);

        // Clean up: delete the duplicate
        await request(`/projects/${data.data.project._id}`, {
            method: 'DELETE',
        });
        console.log('Duplicate project cleaned up');

        return true;
    } else {
        console.log('❌ Failed to duplicate project');
        return false;
    }
}

async function testDeleteNode() {
    console.log('\n=== TEST 11: Delete Chat Node ===');
    const data = await request(`/projects/${projectId}/canvas/node/test-node-1`, {
        method: 'DELETE',
    });

    if (data.status) {
        console.log('✅ Node deleted successfully');
        return true;
    } else {
        console.log('❌ Failed to delete node');
        return false;
    }
}

async function testDeleteProject() {
    console.log('\n=== TEST 12: Delete Project ===');
    const data = await request(`/projects/${projectId}`, {
        method: 'DELETE',
    });

    if (data.status) {
        console.log('✅ Project deleted successfully');
        return true;
    } else {
        console.log('❌ Failed to delete project');
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('========================================');
    console.log('   Project API Test Suite');
    console.log('========================================');
    console.log(`API Base URL: ${BASE_URL}`);
    console.log(`Test User: ${EMAIL}`);

    const results = [];

    try {
        // Must login first to get token
        if (!await testLogin()) {
            console.log('\n❌ Login failed. Please check credentials and try again.');
            console.log('Make sure:');
            console.log('1. Backend server is running');
            console.log('2. User exists in database');
            console.log('3. Email and password are correct');
            return;
        }

        // Run all tests
        results.push(['Create Project', await testCreateProject()]);
        results.push(['List Projects', await testListProjects()]);
        results.push(['Get Project', await testGetProject()]);
        results.push(['Update Project', await testUpdateProject()]);
        results.push(['Add Node', await testAddNode()]);
        results.push(['Update Canvas', await testUpdateCanvas()]);
        results.push(['Add Chat Message', await testAddChatMessage()]);
        results.push(['Get Chat History', await testGetChatHistory()]);
        results.push(['Duplicate Project', await testDuplicateProject()]);
        results.push(['Delete Node', await testDeleteNode()]);
        results.push(['Delete Project', await testDeleteProject()]);

    } catch (error) {
        console.error('\n❌ Test suite failed with error:', error.message);
    }

    // Print summary
    console.log('\n========================================');
    console.log('   Test Results Summary');
    console.log('========================================');

    let passed = 0;
    let failed = 0;

    results.forEach(([name, result]) => {
        const status = result ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${name}`);
        if (result) passed++;
        else failed++;
    });

    console.log('========================================');
    console.log(`Total: ${results.length} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('========================================');

    if (failed === 0) {
        console.log('\n🎉 All tests passed! Project API is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the errors above.');
    }
}

// Run the tests
runTests().catch(console.error);

