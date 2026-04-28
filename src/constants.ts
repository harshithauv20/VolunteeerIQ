export const DEFAULT_VOLUNTEERS = [
  {
    id: "v1",
    name: "Anya Sharma",
    age: 28,
    location: "South Delhi",
    self_description: "I am a former high school teacher with 5 years of experience in mathematics. I love working with teenagers and helping them find confidence in their abilities. I also enjoy outdoor activities and can help with physical labor if needed.",
    past_tasks: [
      { id: "t101", name: "Weekend Tutoring", status: "completed", date: "2024-03-15" },
      { id: "t102", name: "Neighborhood Cleanup", status: "completed", date: "2024-03-20" },
      { id: "t103", name: "Plantation Drive", status: "cancelled_late", date: "2024-04-10" }
    ],
    availability: "Weekends (10 AM - 4 PM)",
    fatigue_score: 2,
    email: "anya@example.com"
  },
  {
    id: "v2",
    name: "Rahul Verma",
    age: 35,
    location: "Gurugram",
    self_description: "Tech lead at a software firm. I have strong organizational skills and experience in project management. I used to coach kids on weekends during college. Interested in mentorship and tech-for-good projects.",
    past_tasks: [
      { id: "t104", name: "Tech Workshop for NGOs", status: "completed", date: "2024-02-15" },
      { id: "t105", name: "Admin Setup", status: "completed", date: "2024-03-01" },
      { id: "t106", name: "Data Entry", status: "completed", date: "2024-04-05" }
    ],
    availability: "Tuesday/Thursday evenings after 7 PM",
    fatigue_score: 5,
    email: "rahul@example.com"
  },
  {
    id: "v3",
    name: "Priya Dass",
    age: 22,
    location: "Noida",
    self_description: "Social work student. Very passionate about elderly care and food security. I have a lot of free time currently as I am between semesters. I can handle coordination and fieldwork.",
    past_tasks: [
      { id: "t107", name: "Old Age Home Visit", status: "completed", date: "2024-04-20" },
      { id: "t108", name: "Food Distribution", status: "completed", date: "2024-04-25" }
    ],
    availability: "Flexible weekdays",
    fatigue_score: 3,
    email: "priya@example.com"
  }
];

export const DEFAULT_TASKS = [
  {
    task_id: "t1",
    task_name: "Youth Mentorship Program",
    ngo_name: "Ignite Foundation",
    description: "Guidance for underprivileged teenagers on career paths and soft skills. Requires someone who can communicate empathy and build trust.",
    required_skills: "Empathy, teaching experience, patience, youth coordination",
    location: "Vasant Kunj",
    date: "2026-05-10",
    time: "11:00 AM",
    urgency: "high",
    min_volunteers_needed: 2,
    current_assigned: []
  },
  {
    task_id: "t2",
    task_name: "NGO Digital Audit",
    ngo_name: "Care Hands",
    description: "Assess our current technical infrastructure and suggest improvements for better data management.",
    required_skills: "Tech strategy, IT infrastructure knowledge, technical auditing",
    location: "Remote",
    date: "2026-05-15",
    time: "Flexible",
    urgency: "medium",
    min_volunteers_needed: 1,
    current_assigned: ["v2"]
  },
  {
    task_id: "t3",
    task_name: "Community Kitchen Drive",
    ngo_name: "Hunger Zero",
    description: "Help prepare and serve hot meals to 50+ homeless individuals in Central Delhi.",
    required_skills: "Cooking, food service, teamwork, physical stamina",
    location: "Connaught Place",
    date: "2026-04-28",
    time: "5:00 PM",
    urgency: "high",
    min_volunteers_needed: 5,
    current_assigned: ["v3"]
  }
];
