// Test Fixture 03: Vulnerable Source Code Patterns
const child_process = require("child_process");

function handleUserRequest(req, res) {
  const userInput = req.query.cmd;

  // Dangerous shell command execution
  child_process.exec("ping -c 4 " + userInput, (err, stdout) => {
    if (err) return res.status(500).send(err.message);
    res.send(stdout);
  });

  // Dynamic evaluation
  const calcExpression = req.body.formula;
  const result = eval(calcExpression);
  return result;
}

module.exports = { handleUserRequest };
