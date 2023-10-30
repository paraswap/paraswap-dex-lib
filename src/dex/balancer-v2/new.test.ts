import dotenv from 'dotenv';
dotenv.config();


describe('Test', () => {
  it('should pass', () => {
    console.log(process.env.TENDERLY_PROJECT);
    expect(true).toBe(true);
  })
});
