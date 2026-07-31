export const AssignmentConfig = {
  // Weights for Trainer Score Calculation (must sum to 1.0)
  weights: {
    availability: 0.30,         // 30%
    distance: 0.25,             // 25%
    reliability: 0.20,          // 20%
    rating: 0.10,               // 10%
    workload: 0.10,             // 10%
    acceptanceRate: 0.05,       // 5%
  },
  
  serviceRadiusKm: 10,          // Maximum allowed distance in kilometers
  responseTimeoutSec: 60,       // Trainer response window in seconds
  cooldownDurationMin: 15,      // Cooldown in minutes after completing a session
  maxDailySessions: 4,          // Maximum daily sessions allowed per trainer
  maxConsecutiveSessions: 2,    // Maximum consecutive sessions before mandatory rest
};
