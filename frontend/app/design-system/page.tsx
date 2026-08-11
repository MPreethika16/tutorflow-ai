import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Navigation } from "@/components/layout/Navigation";

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-12">
        <PageHeader 
          title="Design System" 
          description="Visual components and tokens for the TutorFlow platform."
          action={<Button>Primary Action</Button>}
        />

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">Colors</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="h-20 w-full bg-background border border-border rounded-md" />
              <div className="text-sm">Background (Ivory)</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 w-full bg-surface border border-border rounded-md" />
              <div className="text-sm">Surface (White)</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 w-full bg-primary rounded-md" />
              <div className="text-sm">Primary (Teal)</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 w-full bg-secondary rounded-md" />
              <div className="text-sm">Secondary (Sage)</div>
            </div>
            <div className="space-y-2">
              <div className="h-20 w-full bg-warning rounded-md" />
              <div className="text-sm">Warning (Amber)</div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">Typography</h2>
          <div className="space-y-4">
            <h1 className="text-4xl font-heading font-bold">Newsreader Heading 1</h1>
            <h2 className="text-3xl font-heading font-semibold">Newsreader Heading 2</h2>
            <h3 className="text-2xl font-heading font-medium">Newsreader Heading 3</h3>
            <p className="text-base font-sans">
              Plus Jakarta Sans Body Text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Pellentesque in euismod nulla, sit amet viverra risus. Curabitur vel accumsan nunc. 
              Suspendisse varius, ex a convallis imperdiet, turpis arcu vulputate leo.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">Inputs</h2>
          <div className="max-w-sm space-y-4">
            <Input label="Student Name" placeholder="Jane Doe" />
            <Input label="Email Address" type="email" error="Please enter a valid email address" />
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">Badges</h2>
          <div className="flex flex-wrap gap-4">
            <Badge variant="default">Active</Badge>
            <Badge variant="secondary">Draft</Badge>
            <Badge variant="warning">Needs Review</Badge>
            <Badge variant="outline">Archived</Badge>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">Alerts</h2>
          <div className="space-y-4 max-w-2xl">
            <Alert>
              <AlertTitle>Assessment Created</AlertTitle>
              <AlertDescription>Your new assessment has been saved successfully and is ready for students.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>Missing Information</AlertTitle>
              <AlertDescription>Please complete the grading rubric before publishing this assessment.</AlertDescription>
            </Alert>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">Cards</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/70">
                  Midterm evaluating student understanding of core mathematical principles.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">View Details</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-heading font-semibold border-b border-border pb-2">States</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Empty State</h3>
              <EmptyState 
                title="No students found" 
                description="Get started by adding your first student to the platform."
                action={<Button>Add Student</Button>}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Loading State</h3>
              <div className="border border-border rounded-lg bg-surface">
                <LoadingState />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
