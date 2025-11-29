"use client";

import Image from "next/image";
import FileUpload from "../components/FileUpload";

export default function Home() {
  const handleAprUpload = (file) => {
    console.log("APR Document uploaded:", file.name);
    // TODO: Implement actual upload logic
  };

  const handleBankUpload = (file) => {
    console.log("Bank Account Photo uploaded:", file.name);
    // TODO: Implement actual upload logic
  };

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black">
      {/* Navigation */}
      <header className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <a href="#" className="-m-1.5 p-1.5">
            <span className="sr-only">Invoice App</span>
            <Image
              className="h-8 w-auto dark:invert"
              src="/next.svg"
              alt="Logo"
              width={100}
              height={24}
            />
          </a>
        </div>
        <div className="flex flex-1 justify-end gap-x-6">
          <button className="text-sm font-semibold leading-6 text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300">
            Log in
          </button>
          <button className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            Sign up
          </button>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <div className="relative isolate px-6 pt-14 lg:px-8">
          <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                Generate Invoices Effortlessly
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                Upload your APR document and bank account details to get started. We handle the rest.
              </p>
            </div>

            {/* Upload Section */}
            <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:justify-center">
              <div className="w-full sm:w-1/2 max-w-md">
                <FileUpload
                  id="apr-upload"
                  label="Upload APR Document"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleAprUpload}
                />
              </div>
              <div className="w-full sm:w-1/2 max-w-md">
                <FileUpload
                  id="bank-upload"
                  label="Upload Bank Account Photo"
                  accept=".jpg,.jpeg,.png"
                  onChange={handleBankUpload}
                />
              </div>
            </div>

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <a
                href="#"
                className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Get started
              </a>
              <a href="#" className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
                Learn more <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
