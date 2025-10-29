import React from "react";

export default function Prompt() {
  return (
    <>
      <h3 className="flex justify-center text-4xl">Prompt</h3>
      <div className="question flex flex-col mt-4 mb-3 flex-grow border border-gray-200 rounded-lg gap-4 px-3 overflow-scroll">
        <span className="body-text-small">
          We will describe an issue and provide three different perspectives on the issue. You are asked to read and consider the issue and perspectives, state your own perspective on the issue, and analyze the relationship between your perspective and at least one other perspective on the issue.
        </span>
        <span>
          <h2 className="font-bold flex justify-center text-lg">Issue:</h2>
          <p>
            Automation is generally seen as a sign of progress, but what is lost when we replace humans with machines?
          </p>
        </span>
        <span>
          <h2 className="font-bold flex justify-center text-lg">Intelligent Machines</h2>
          <span className="my-1 body-text-small-dark">
            Many of the goods and services we depend on daily are now supplied by intelligent, automated machines rather than human beings. Robots build cars and other goods on assembly lines, where once there were human workers. Many of our phone conversations are now conducted not with people but with sophisticated technologies. We can now buy goods at a variety of stores without the help of a human cashier. Automation is generally seen as a sign of progress, but what is lost when we replace humans with machines? Given the accelerating variety and prevalence of intelligent machines, it is worth examining the implications and meaning of their presence in our lives.
          </span>
        </span>
        <div className="flex flex-col gap-4">
          <div className="mb-3 border-black">
            <h3 className="font-bold flex justify-center text-lg">Perspective One (Dystopian view)</h3>
            <span className="body-text-small-dark">
              What we lose with the replacement of people by machines is some part of our own humanity. Even our mundane daily encounters no longer require from us basic courtesy, respect, and tolerance for other people.
            </span>
          </div>
          <div className="my-3 border-black">
            <h3 className="font-bold flex justify-center text-lg">Perspective Two (Utilitarian view)</h3>
            <span className="body-text-small-dark">
              Machines are good at low-skill, repetitive jobs, and at high-speed, extremely precise jobs. In both cases they work better than humans. This efficiency leads to a more prosperous and progressive world for everyone.
            </span>
          </div>
          <div className="mt-3 border-black">
            <h3 className="font-bold flex justify-center text-lg">Perspective Three (Progressive view)</h3>
            <span className="body-text-small-dark">
              Intelligent machines challenge our long-standing ideas about what humans are or can be. This is good because it pushes both humans and machines toward new, unimagined possibilities.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}