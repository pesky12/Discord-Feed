import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Menu, Button, Dropdown } from 'antd'
import { CalendarOutlined, LoadingOutlined } from '@ant-design/icons'

const CalendarEventButton = ({ eventData }) => {
  const [loading, setLoading] = useState(false)
  
  // Debug log to see the eventData being received
  useEffect(() => {
    console.log('CalendarEventButton - received eventData:', eventData)
  }, [eventData])

  const handleCalendarAction = async (type) => {
    setLoading(true)
    try {
      if (!eventData?.eventDetails) {
        throw new Error('No event details available')
      }
      
      const details = {
        title: eventData.eventDetails.title,
        date: eventData.eventDetails.date,
        time: eventData.eventDetails.time,
        endDate: eventData.eventDetails.endDate || eventData.eventDetails.date,
        endTime: eventData.eventDetails.endTime || '',
        description: eventData.eventDetails.description,
        location: eventData.eventDetails.location || ''
      }

      // Log the processed details
      console.log('CalendarEventButton - processing details:', details)

      let url
      switch (type) {
        case 'google':
          url = generateGoogleCalendarUrl(details)
          break
        case 'outlook':
          url = generateOutlookCalendarUrl(details)
          break
        case 'ical':
          url = generateICalendarUrl(details)
          break
        default:
          throw new Error('Unsupported calendar type')
      }

      window.electron.ipcRenderer.send('open-external', url)
    } catch (error) {
      console.error('Failed to create calendar event:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateGoogleCalendarUrl = (details) => {
    if (!details.date || !details.time) {
      throw new Error('Missing required date/time information')
    }

    // Base URL for Google Calendar event creation
    const baseUrl = 'https://calendar.google.com/calendar/render'
    const action = 'action=TEMPLATE'
    
    // Create properly formatted start and end dates in UTC
    const startDate = createDateObject(details.date, details.time)
    const endDate = details.endTime 
      ? createDateObject(details.endDate || details.date, details.endTime)
      : new Date(startDate.getTime() + 60 * 60 * 1000) // Default: +1 hour
    
    // Format dates for Google Calendar (YYYYMMDDTHHmmssZ)
    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '')
    }
    
    const dates = `dates=${formatDate(startDate)}/${formatDate(endDate)}`
    const text = `text=${encodeURIComponent(details.title || 'Event')}`
    const location = details.location ? `&location=${encodeURIComponent(details.location)}` : ''
    const description = details.description ? `&details=${encodeURIComponent(details.description)}` : ''
    
    return `${baseUrl}?${action}&${text}&${dates}${location}${description}`
  }

  const generateOutlookCalendarUrl = (details) => {
    // Base URL for Outlook Calendar event creation
    const baseUrl = 'https://outlook.office.com/calendar/0/deeplink/compose'
    
    // Create properly formatted start and end dates
    const startDate = createDateObject(details.date, details.time)
    const endDate = details.endTime 
      ? createDateObject(details.endDate || details.date, details.endTime)
      : new Date(startDate.getTime() + 60 * 60 * 1000) // Default: +1 hour
      
    // Format dates for Outlook (ISO format)
    const params = new URLSearchParams()
    params.append('subject', details.title || 'Event')
    params.append('body', details.description || '')
    params.append('location', details.location || '')
    params.append('startdt', startDate.toISOString())
    params.append('enddt', endDate.toISOString())
    params.append('path', '/calendar/action/compose')
    
    return `${baseUrl}?${params.toString()}`
  }

  const generateICalendarUrl = (details) => {
    const icsContent = generateICSContent(details)
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    return URL.createObjectURL(blob)
  }

  const createDateObject = (dateStr, timeStr) => {
    // Parse date components (YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-').map(Number)
    
    // Parse time components (HH:MM)
    const [hours, minutes] = timeStr.split(':').map(Number)
    
    // Create JavaScript Date object (in local timezone)
    const date = new Date(year, month - 1, day, hours, minutes)
    
    return date
  }

  const generateICSContent = (details) => {
    // Create start and end date objects
    const startDate = createDateObject(details.date, details.time)
    const endDate = details.endTime 
      ? createDateObject(details.endDate || details.date, details.endTime)
      : new Date(startDate.getTime() + 60 * 60 * 1000) // Default: +1 hour
    
    // Format dates for iCalendar (YYYYMMDDTHHmmssZ)
    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
    }
    
    // Ensure valid inputs for calendar event
    const title = details.title ? details.title.replace(/\n/g, '\\n') : 'Event'
    const description = details.description ? details.description.replace(/\n/g, '\\n') : ''
    const location = details.location ? details.location.replace(/\n/g, '\\n') : ''
    
    // Generate the ICS content
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Discord-Feed//Calendar Event//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${Date.now()}-${Math.floor(Math.random() * 100000)}@discord-feed
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`
  }

  const menu = (
    <Menu>
      <Menu.Item key="google" onClick={() => handleCalendarAction('google')}>
        Add to Google Calendar
      </Menu.Item>
      <Menu.Item key="outlook" onClick={() => handleCalendarAction('outlook')}>
        Add to Outlook Calendar
      </Menu.Item>
      <Menu.Item key="ical" onClick={() => handleCalendarAction('ical')}>
        Download ICS File
      </Menu.Item>
    </Menu>
  )

  // Debug output of the condition check
  const hasRequiredFields = !!(
    eventData?.eventDetails?.title && 
    eventData?.eventDetails?.date && 
    eventData?.eventDetails?.time
  )
  
  console.log('CalendarEventButton - component render check:', { 
    hasRequiredFields, 
    title: eventData?.eventDetails?.title,
    date: eventData?.eventDetails?.date,
    time: eventData?.eventDetails?.time,
    eventDataExists: !!eventData,
    eventDetailsExists: !!eventData?.eventDetails
  })

  // Only show the button if we have the required event details
  if (!hasRequiredFields) {
    return (
      <div style={{display: 'none'}}>
        Missing fields for calendar: 
        Title: {eventData?.eventDetails?.title ? 'YES' : 'NO'}, 
        Date: {eventData?.eventDetails?.date ? 'YES' : 'NO'}, 
        Time: {eventData?.eventDetails?.time ? 'YES' : 'NO'}
      </div>
    )
  }

  return (
    <Dropdown overlay={menu} placement="bottomRight">
      <Button 
        type="text" 
        icon={loading ? <LoadingOutlined /> : <CalendarOutlined />}
        disabled={loading}
      >
        Add to Calendar
      </Button>
    </Dropdown>
  )
}

CalendarEventButton.propTypes = {
  eventData: PropTypes.shape({
    eventDetails: PropTypes.shape({
      title: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
      endDate: PropTypes.string,
      endTime: PropTypes.string,
      description: PropTypes.string,
      location: PropTypes.string
    })
  }).isRequired
}

export default CalendarEventButton