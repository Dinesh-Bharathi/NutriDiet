import argon2 from "argon2";

const plainPassword = "Password@123";

const hash = await argon2.hash(plainPassword, {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});

console.log(hash);
